import { html, LitElement, css } from 'lit';

export class LionCarousel extends LitElement {
  static get properties() {
    return {
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
    this.__addEventListenerNext();
    this.__addEventListenerPrevious();
    this.__addEventListenerRotation();
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

  __addEventListenerNext() {
    const nextButtonNode = this.shadowRoot?.querySelector('.carousel .controls button.next');
    if (nextButtonNode)
      nextButtonNode.addEventListener('click', () => this.__handleNextButtonClick());
  }

  __addEventListenerPrevious() {
    const previousButtonNode = this.shadowRoot?.querySelector(
      '.carousel .controls button.previous',
    );
    if (previousButtonNode)
      previousButtonNode.addEventListener('click', () => this.__handlePreviousButtonClick());
  }

  __addEventListenerRotation() {
    const rotationButtonNode = this.shadowRoot?.querySelector(
      '.carousel .controls button.rotation',
    );
    if (rotationButtonNode)
      rotationButtonNode.addEventListener('click', () => this.__handleRotationButtonClick());
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
            <div class="carousel-item active">
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
            <button type="button" class="rotation pause" aria-label="Rotation Pause">
              ${this.autoRotation ? 'Pause' : 'Play'}
            </button>
            <button type="button" class="previous" aria-label="Previous Slide">Previous</button>
            <button type="button" class="next" aria-label="Next Slide">Next</button>
          </div>
        </div>
      </div>
    `;
  }
}
