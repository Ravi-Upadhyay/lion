import child_process from 'child_process'; // eslint-disable-line camelcase
import path from 'path';
import { AstService } from './AstService.js';
import { LogService } from './LogService.js';
import { getFilePathRelativeFromRoot } from '../utils/get-file-path-relative-from-root.js';
import { getCurrentDir } from '../utils/get-current-dir.js';
// import { memoize } from '../utils/memoize.js';

const memoize = fn => fn;

/**
 * @typedef {import('./Analyzer.js').Analyzer} Analyzer
 * @typedef {import('../../../types/index.js').FindImportsAnalyzerResult} FindImportsAnalyzerResult
 * @typedef {import('../../../types/index.js').FindImportsAnalyzerEntry} FindImportsAnalyzerEntry
 * @typedef {import('../../../types/index.js').PathRelativeFromProjectRoot} PathRelativeFromProjectRoot
 * @typedef {import('../../../types/index.js').QueryConfig} QueryConfig
 * @typedef {import('../../../types/index.js').QueryResult} QueryResult
 * @typedef {import('../../../types/index.js').FeatureQueryConfig} FeatureQueryConfig
 * @typedef {import('../../../types/index.js').SearchQueryConfig} SearchQueryConfig
 * @typedef {import('../../../types/index.js').AnalyzerQueryConfig} AnalyzerQueryConfig
 * @typedef {import('../../../types/index.js').Feature} Feature
 * @typedef {import('../../../types/index.js').ProjectInputData} ProjectInputData
 * @typedef {import('../../../types/index.js').AnalyzerConfig} AnalyzerConfig
 * @typedef {import('../../../types/index.js').AnalyzerName} AnalyzerName
 * @typedef {import('../../../types/index.js').AnalyzerAst} AnalyzerAst
 * @typedef {import('../../../types/index.js').PathFromSystemRoot} PathFromSystemRoot
 * @typedef {import('../../../types/index.js').GatherFilesConfig} GatherFilesConfig
 * @typedef {import('../../../types/index.js').AnalyzerQueryResult} AnalyzerQueryResult
 */

const astProjectsDataCache = new Map();

export class QueryService {
  /**
   * @param {string} regexString string for 'free' regex searches.
   * @returns {SearchQueryConfig}
   */
  static getQueryConfigFromRegexSearchString(regexString) {
    if (typeof regexString !== 'string') {
      throw new Error('[QueryService.getQueryConfigFromRegexSearchString]: provide a string');
    }
    return { type: 'search', regexString };
  }

  /**
   * Util function that can be used to parse cli input and feed the result object to a new
   * instance of QueryResult
   * @example
   * const queryConfig = QueryService.getQueryConfigFromFeatureString(”tg-icon[size=xs]”)
   * const myQueryResult = QueryService.grepSearch(inputData, queryConfig)
   * @param {string} queryString - string like ”tg-icon[size=xs]”
   * @returns {FeatureQueryConfig}
   */
  static getQueryConfigFromFeatureString(queryString) {
    if (typeof queryString !== 'string') {
      throw new Error('[QueryService.getQueryConfigFromFeatureString]: provide a string');
    }

    /**
     * Each candidate (tag, attrKey or attrValue) can end with asterisk.
     * @param {string} candidate for my-*[attr*=x*] 'my-*', 'attr*' or 'x*'
     * @returns {[string, boolean]}
     */
    function parseContains(candidate) {
      const hasAsterisk = candidate ? candidate.endsWith('*') : false;
      const filtered = hasAsterisk ? candidate.slice(0, -1) : candidate;
      return [filtered, hasAsterisk];
    }

    // Detect the features in the query
    let tagCandidate;
    let featString;

    // Creates tag ('tg-icon') and featString ('font-icon+size=xs')
    const attrMatch = queryString.match(/(^.*)(\[(.+)\])+/);
    if (attrMatch) {
      // eslint-disable-next-line prefer-destructuring
      tagCandidate = attrMatch[1];
      // eslint-disable-next-line prefer-destructuring
      featString = attrMatch[3];
    } else {
      tagCandidate = queryString;
    }

    const [tag, usesTagPartialMatch] = parseContains(tagCandidate);

    let featureObj;
    if (featString) {
      const [nameCandidate, valueCandidate] = featString.split('=');
      const [name, usesValueContains] = parseContains(nameCandidate);
      const [value, usesValuePartialMatch] = parseContains(valueCandidate);
      featureObj = /** @type {Feature} */ {
        name,
        value,
        tag,
        isAttribute: true,
        usesValueContains,
        usesValuePartialMatch,
        usesTagPartialMatch,
      };
    } else {
      // Just look for tag name
      featureObj = /** @type {Feature} */ ({ tag, usesTagPartialMatch });
    }

    return { type: 'feature', feature: featureObj };
  }

  /**
   * Retrieves the default export found in ./program/analyzers/find-import.js
   * @param {typeof Analyzer} analyzerCtor
   * @param {AnalyzerConfig} [analyzerConfig]
   * @returns {Promise<AnalyzerQueryConfig>}
   */
  static async getQueryConfigFromAnalyzer(analyzerObjectOrString, analyzerConfig) {
    let analyzer;
    if (typeof analyzerObjectOrString === 'string') {
      // Get it from our location(s) of predefined analyzers.
      // Mainly needed when this method is called via cli
      try {
        // eslint-disable-next-line import/no-dynamic-require, global-require
        const module = /** @type {Analyzer} */ (
          await import(
            path.join(
              'file:///',
              path.resolve(
                getCurrentDir(import.meta.url),
                `../analyzers/${analyzerObjectOrString}.js`,
              ),
            )
          )
        );
        analyzer = module.default;
      } catch (e) {
        LogService.error(e.toString());
        process.exit(1);
      }
    } else {
      // We don't need to import the analyzer, since we already have it
      analyzer = analyzerObjectOrString;
    }
    return /** @type {AnalyzerQueryConfig} */ ({
      type: 'ast-analyzer',
      analyzerName: /** @type {AnalyzerName} */ (analyzer.analyzerName),
      analyzerConfig,
      analyzer,
    });
  }

  /**
   * Search via unix grep
   * @param {ProjectInputData} inputData
   * @param {FeatureQueryConfig|SearchQueryConfig} queryConfig
   * @param {{hasVerboseReporting:boolean;gatherFilesConfig:GatherFilesConfig}} [customConfig]
   * @returns {Promise<QueryResult>}
   */
  static async grepSearch(inputData, queryConfig, customConfig) {
    const cfg = {
      hasVerboseReporting: false,
      gatherFilesConfig: {},
      ...customConfig,
    };

    const results = [];
    // 1. Analyze the type of query from the QueryConfig (for instance 'feature' or 'search').
    let regex;
    if (queryConfig.type === 'feature') {
      regex = this._getFeatureRegex(queryConfig.feature);
    } else if (queryConfig.type === 'search') {
      regex = queryConfig.regexString;
    }

    await Promise.all(
      inputData.map(async projectData => {
        // 2. For all files found in project, we will do a different grep
        const projectResult = {};
        const countStdOut = await this._performGrep(projectData.project.path, regex, {
          count: true,
          gatherFilesConfig: cfg.gatherFilesConfig,
        });
        projectResult.count = Number(countStdOut);

        if (cfg.hasVerboseReporting) {
          const detailStdout = await this._performGrep(projectData.project.path, regex, {
            count: false,
            gatherFilesConfig: cfg.gatherFilesConfig,
          });
          projectResult.files = detailStdout
            .split('\n')
            .filter(l => l)
            .map(l => {
              const [absolutePath, line] = l.split(':');
              const file = getFilePathRelativeFromRoot(absolutePath, projectData.path);
              const link = l.split(':').slice(0, 2).join(':');
              const match = l.split(':').slice(2);
              return { file, line: Number(line), match, link };
            });
        }
        results.push({ project: projectData.project, ...projectResult });
      }),
    );

    return /** @type {QueryResult} */ {
      meta: {
        searchType: 'grep',
        query: queryConfig,
      },
      queryOutput: results,
    };
  }

  /**
   * Perform ast analysis
   * @param {AnalyzerQueryConfig} analyzerQueryConfig
   * @param {AnalyzerConfig} [customConfig]
   * @returns {Promise<AnalyzerQueryResult>}
   */
  static async astSearch(analyzerQueryConfig, customConfig) {
    LogService.debug('started astSearch method');
    if (analyzerQueryConfig.type !== 'ast-analyzer') {
      LogService.error('Only analyzers supported for ast searches at the moment');
      process.exit(1);
    }

    // @ts-ignore
    // eslint-disable-next-line new-cap
    const analyzer = new analyzerQueryConfig.analyzer();
    const analyzerResult = await analyzer.execute(customConfig);
    if (!analyzerResult) {
      return analyzerResult;
    }
    const { queryOutput, analyzerMeta } = analyzerResult;
    const /** @type {AnalyzerQueryResult} */ queryResult = {
        meta: {
          searchType: 'ast-analyzer',
          analyzerMeta,
        },
        queryOutput,
      };
    return queryResult;
  }

  /**
   * @param {ProjectInputData[]} projectsData
   * @param {AnalyzerAst} requiredAst
   */
  static async addAstToProjectsData(projectsData, requiredAst) {
    return projectsData.map(projectData => {
      const cachedData = astProjectsDataCache.get(projectData.project.path);
      if (cachedData) {
        return cachedData;
      }

      const resultEntries = projectData.entries.map(entry => {
        const ast = AstService.getAst(entry.context.code, requiredAst, { filePath: entry.file });
        return { ...entry, ast };
      });
      const astData = { ...projectData, entries: resultEntries };
      this._addToProjectsDataCache(`${projectData.project.path}#${requiredAst}`, astData);
      return astData;
    });
  }

  /**
   * We need to make sure we don't run into memory issues (ASTs are huge),
   * so we only store one project in cache now. This will be a performance benefit for
   * lion-based-ui-cli, that runs providence consecutively for the same project
   * TODO: instead of storing one result in cache, use sizeof and a memory limit
   * to allow for more projects
   * @param {string} pathAndRequiredAst
   * @param {ProjectInputData} astData
   */
  static _addToProjectsDataCache(pathAndRequiredAst, astData) {
    if (this.cacheDisabled) {
      return;
    }
    // In order to prevent running out of memory, there is a limit to the number of
    // project ASTs in cache. For a session running multiple analyzers for reference
    // and target projects, we need this number to be at least 2.
    if (astProjectsDataCache.size >= 2) {
      astProjectsDataCache.delete(astProjectsDataCache.keys()[0]);
    }
    astProjectsDataCache.set(pathAndRequiredAst, astData);
  }

  /**
   * Performs a grep on given path for a certain tag name and feature
   * @param {Feature} feature
   */
  static _getFeatureRegex(feature) {
    const { name, value, tag } = feature;
    let potentialTag;
    if (tag) {
      potentialTag = feature.usesTagPartialMatch ? `.*${tag}.+` : tag;
    } else {
      potentialTag = '.*';
    }

    let regex;
    if (name) {
      if (value) {
        // We are looking for an exact match: div[class=foo] -> <div class="foo">
        let valueRe = value;
        if (feature.usesValueContains) {
          if (feature.usesValuePartialMatch) {
            // We are looking for a partial match: div[class*=foo*] -> <div class="baz foo-bar">
            valueRe = `.+${value}.+`;
          } else {
            // We are looking for an exact match inside a space separated list within an
            // attr: div[class*=foo] -> <div class="baz foo bar">
            valueRe = `((${value})|("${value} .*)|(.* ${value}")|(.* ${value} .*))`;
          }
        }
        regex = `<${potentialTag} .*${name}="${valueRe}".+>`;
      } else {
        regex = `<${potentialTag} .*${name}(>|( |=).+>)`;
      }
    } else if (tag) {
      regex = `<${potentialTag} .+>`;
    } else {
      LogService.error('Please provide a proper Feature');
    }

    return regex;
  }

  /**
   *
   * @param {PathFromSystemRoot} searchPath
   * @param {string} regex
   * @param {{ count:number; gatherFilesConfig:GatherFilesConfig; hasDebugEnabled:boolean }} customConfig
   * @returns
   */
  static _performGrep(searchPath, regex, customConfig) {
    const cfg = {
      count: false,
      gatherFilesConfig: {},
      hasDebugEnabled: false,
      ...customConfig,
    };

    const /** @type {string[]} */ ext = cfg.gatherFilesConfig.extensions;
    const include = ext ? `--include="\\.(${ext.map(e => e.slice(1)).join('|')})" ` : '';
    const count = cfg.count ? ' | wc -l' : '';

    // TODO: test on Linux (only tested on Mac)
    const cmd = `pcregrep -ornM ${include} '${regex}' ${searchPath} ${count}`;

    if (cfg.hasDebugEnabled) {
      LogService.debug(cmd, 'grep command');
    }

    return new Promise(resolve => {
      // eslint-disable-next-line camelcase
      child_process.exec(cmd, { maxBuffer: 200000000 }, (err, stdout) => {
        resolve(stdout);
      });
    });
  }
}
QueryService.cacheDisabled = false;
QueryService.addAstToProjectsData = memoize(QueryService.addAstToProjectsData);
