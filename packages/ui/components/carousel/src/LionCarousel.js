import { html, LitElement, css } from 'lit';
import { LionButton } from '@lion/ui/button.js';
import { ScopedElementsMixin } from '@open-wc/scoped-elements/lit-element.js';

export class LionCarousel extends ScopedElementsMixin(LitElement) {
  static get scopedElements() {
    return {
      'lion-button': LionButton,
    };
  }

  static get properties() {
    return {
      slides: { type: Array },
      autoRotation: { type: Boolean, reflect: true },
      timeInterval: { type: Number },
      __slides: { type: Array },
      __currentSlideIndex: { type: Number },
      __totalSlides: { type: Number },
    };
  }

  static get styles() {
    return [
      css`
        .carousel {
          background-color: #eee;
          max-width: 900px;
        }

        .carousel .carousel-inner {
          position: relative;
        }

        .carousel .carousel-items.focus {
          padding: 2px;
          border: solid 3px #005a9c;
        }

        .carousel .carousel-item {
          display: none;
          // Standard was max-height: 400px;
          height: auto;
          max-width: 900px;
          position: relative;
          overflow: hidden;
          width: 100%;
        }

        .carousel .carousel-item.active {
          display: block;
        }
      `,
    ];
  }

  constructor() {
    super();
    this.autoRotation = false;
    this.timeInterval = 5000;
    this.__initializeSlides();
  }

  firstUpdated(_changedProperties) {
    super.firstUpdated(_changedProperties);
    this.__handleSlideChange();
  }

  __initializeSlides() {
    this.__slides = [
      {
        url: '/_merged_assets/carousel/cats_crossing_road.jpeg',
        alt: 'Cats Crossing Road',
      },
      {
        url: '/_merged_assets/carousel/cats_in_fish_market.jpeg',
        alt: 'Cats In Fish Market',
      },
      {
        url: '/_merged_assets/carousel/cats_on_caribbean.jpeg',
        alt: 'Cats On Caribbean',
      },
    ];
    this.__totalSlides = this.__slides.length;
    this.__currentSlideIndex = 0;
  }

  __nextCurrentSlideIndex() {
    if (this.__totalSlides) {
      this.__currentSlideIndex =
        this.__currentSlideIndex === this.__totalSlides - 1 ? 0 : this.__currentSlideIndex + 1;
    }
  }

  __previousCurrentSlideIndex() {
    if (this.__totalSlides) {
      this.__currentSlideIndex =
        this.__currentSlideIndex === 0 ? this.__totalSlides - 1 : this.__currentSlideIndex - 1;
    }
  }

  __handleSlideChange() {
    const carouselItems = this.shadowRoot?.querySelectorAll(
      '.carousel .carousel-items div.carousel-item',
    );
    if (carouselItems) {
      carouselItems.forEach((carouselItem, index) => {
        if (index === this.__currentSlideIndex) {
          carouselItem.classList.add('active');
        } else {
          carouselItem.classList.remove('active');
        }
      });
    }
  }

  __handleNextButtonClick() {
    this.__nextCurrentSlideIndex();
    this.__handleSlideChange();
  }

  __handlePreviousButtonClick() {
    this.__previousCurrentSlideIndex();
    this.__handleSlideChange();
  }

  __playRotation() {
    this.rotationIntervalHandler = setInterval(
      () => this.__handleNextButtonClick(),
      this.timeInterval,
    );
  }

  __pauseRotation() {
    if (this.rotationIntervalHandler) clearInterval(this.rotationIntervalHandler);
  }

  __handleRotationButtonClick() {
    if (this.autoRotation) this.__pauseRotation();
    else this.__playRotation();
    this.autoRotation = !this.autoRotation;
  }

  // TODO: Composite Rendering - After Initial Tests (Carousel Items)

  render() {
    // TODO: DevelopmentPurposeOnly - Images have been put under "/_site-dev/_merged_assets/carousel".
    return html`
      <div class="carousel" aria-roledescription="carousel" aria-label="Cats are Social">
        <div class="carousel-inner">
          <div class="carousel-items" aria-live="off">
            <div class="carousel-item">
              <img src="${this.__slides[0].url}" alt="${this.__slides[0].alt}" />
            </div>
            <div class="carousel-item">
              <img src="${this.__slides[1].url}" alt="${this.__slides[1].alt}" />
            </div>
            <div class="carousel-item">
              <img src="${this.__slides[2].url}" alt="${this.__slides[2].alt}" />
            </div>
          </div>
          <div class="controls">
            <lion-button
              class="previous"
              aria-label="Previous Slide"
              @click="${this.__handlePreviousButtonClick}"
              >Previous</lion-button
            >
            <lion-button
              class="rotation pause"
              aria-label="Toggle Slide Rotation"
              @click="${this.__handleRotationButtonClick}"
            >
              ${this.autoRotation ? 'Pause' : 'Play'}
            </lion-button>
            <lion-button
              class="next"
              aria-label="Next Slide"
              @click="${this.__handleNextButtonClick}"
              >Next</lion-button
            >
          </div>
        </div>
      </div>
    `;
  }
}
