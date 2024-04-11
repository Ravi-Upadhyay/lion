import { html, LitElement, css } from 'lit';

export class LionCarousel extends LitElement {
  static get properties() {
    return {
      __privateProp: { type: Number },
      publicProp: { type: Number },
    };
  }

  static get styles() {
    return [
      css`
        color: #1b1f23;
      `,
    ];
  }

  constructor() {
    super();
    this.__privateProp = 1;
    this.publicProp = 2;
  }

  render() {
    return html`
      <h1>Initializing the component</h1>
      <p>Private Property Value: ${this.__privateProp}</p>
      <p>Public Property Value: ${this.publicProp}</p>
    `;
  }
}
