import { LitElement, html, css } from 'lit-element';
import { repeat } from 'lit-html/directives/repeat.js';

import 'ace-builds/src-noconflict/ace.js';
import 'ace-builds/src-noconflict/ext-language_tools.js';
import 'ace-builds/src-noconflict/snippets/snippets.js';


/**
 * An example for browsing files in rest-server.
 *
 */
export class FileBrowser extends LitElement {
  static get styles() {
    return css`
      :host {
        display: block;
      }
    `;
  }

  static get properties() {
    return {
      data: { type: Object, notify: true },
      path: { type: String, notify: true },
    };
  }

  constructor() {
    super();
    this.restURL = 'http://localhost:8080/rest-file-server/rest/';
    this.data = {};
    this.path = ".";
  }

  render() {

    return html`
      <h1>File Browser</h1>
      Path: ${this.path}

      ${this.data.children != null ? (this.data.isVersionedFile ? this._renderVersionedFile(this.data) : this._renderFolder(this.data)) : this._renderFile(this.data)}
      `;

  }

  _renderFolder(data) {
    return html`
      <ul>
        ${repeat(this.data.children, (row) => row.name, (row, index) => html`
          <li><button @click=${this._gotoFile}>${row.name}</button> ${row.size} ${new Date(row.lastModified)}</li>
        `)}
      </ul>
    `;
  }

  _renderVersionedFile(data) {
    return html`
      <p>Versioned file ${data.name}
      <file-versions restURL="${this.restURL}" path="${this.path}"></file-versions>
    `;
  }

  _renderFile(data) {
    return html`
      <p>File ${data.name} ${data.size} ${data.lastModified} ${data.mimeType} (<a href="${this.restURL + 'download/' + this.path}">download</a>)
      ${data.mimeType && data.mimeType.startsWith("text/") ? this._renderEditor(this.restURL + 'download/' + this.path) : null}
      ${data.mimeType && data.mimeType.startsWith("image/") ? this._renderImage(this.restURL + 'download/' + this.path) : null}
    `;
  }

  _renderEditor(url) {
    return html`
      <ace-editor readonly fileURL="${url}"></ace-editor>
    `;
  }

  _renderImage(url) {
    return html`
      <img src="${url}">
    `;
  }

  firstUpdated(changedProperties) {
    this.path = window.location.pathname.replace('/dev', '.');
    this._updateData();
    window.onpopstate = (e) => {
      console.log(e.state);
      this._goto(e.state == null ? "." : e.state);
    };
  }

  _updateData() {
    fetch(this.restURL + "list/" + this.path)
      .then(response => response.json())
      .then(data => this.data = data);
  }

  _gotoFile(e) {
    let newPath = this.path + "/" + e.path[0].textContent
    this._goto(newPath);
    window.history.pushState(newPath, 'Content', "/dev" + newPath.substring(1))
  }
  _goto(path) {
    this.data = {};
    this.path = path;
    this._updateData();
  }

}

export class AceEditor extends LitElement {
  static get styles() {
    return css`
        :host {
          display: block;
          width: 100%;
          height: 400px;
        }

        #editor {
          border: 1px solid #e3e3e3;
          border-radius: 4px;
          height: 400px;
          width: 100%;
          @apply --ace-widget-editor;
        }
    `;
  }

  static get properties() {
    return {
      fileURL: { type: String, notify: true },
      value: { type: String, notify: true },
      readonly: { type: Boolean, notify: true },
    };
  }

  constructor() {
    super();
    this.value = 'Loading...';
    this.readonly = false;
  }

  render() {

    return html`
      <textarea ?readOnly=${this.readonly} id="editor">${this.value}</textarea>
      `;
  }

  static get importMeta() { return import.meta; }

  firstUpdated(changedProperties) {
    let div = this.shadowRoot.getElementById('editor');
    //this.editor = ace.edit(div);
    fetch(this.fileURL)
      .then(response => response.text())
      .then(text => this.value = text);
  }

  updated(changedProperties) {
    if (changedProperties.get("fileURL")) {
      this.value = 'Loading...';
      fetch(this.fileURL)
      .then(response => response.text())
      .then(text => this.value = text);
    }
  }

}

export class FileVersions extends LitElement {
  static get styles() {
    return css`
        :host {
          display: block;
        }
    `;
  }

  static get properties() {
    return {
      restURL: { type: String, notify: true },
      data: { type: Object, notify: true },
      path: { type: String, notify: true },
      selectedVersion: { type: String, notify: true },
    };
  };

  constructor() {
    super();
    this.restURL = '';
    this.data = { "versions": [] };
    this.path = ".";
    this.selectedVersion = 'default';
  }

  render() {

    return html`
      <ul>
      ${repeat(this.data.versions, (row) => row.version, (row, index) => html`
        <li>${row.version} ${row.size} ${new Date(row.lastModified)}
        ${row.version == this.data.latest ? html`<b>latest</b>` : null}
        ${row.version == this.data.default ? html`<b>default</b>` : html`<button id=${row.version} @click=${this._makeDefault}>Make Default</button>`}
        (<a href="${this.restURL + 'version/download/' + this.path+"?version="+row.version}">download</a>)
        </li>
      `)}
      </ul>
      Version: <select id="selectedVersion" @change=${this._selectionChanged}>
        <option value="default" ?selected=${this.selectedVersion == "default"}>default</option>
        <option value="latest" ?selected=${this.selectedVersion == "latest"}>latest</option>
        ${repeat(this.data.versions, (row) => row.version, (row, index) => html`
          <option value=${row.version} ?selected=${this.selectedVersion == row.version}>${row.version}</option>
        `)}
        </select>
        <ace-editor readonly fileURL="${this.restURL+"version/download/"+this.path+"?version="+this.selectedVersion}"></ace-editor>
    `;
  }

  firstUpdated(changedProperties) {
    fetch(this.restURL + "version/info/" + this.path)
      .then(response => response.json())
      .then(versions => this.data = versions);
  }

  _selectionChanged() {
      let selection = this.shadowRoot.querySelector('#selectedVersion');
      this.selectedVersion = selection.value;
  }

  _makeDefault(e) {
    let defaultId = parseInt(e.path[0].id);
    fetch(this.restURL + "version/set/" + this.path, { method: 'PUT', body: JSON.stringify(defaultId), headers: {'Content-type': 'application/json; charset=UTF-8'}})
      .then(response => response.json())
      .then(versions => this.data = versions);
  }
}

window.customElements.define('file-browser', FileBrowser);
window.customElements.define('ace-editor', AceEditor);
window.customElements.define('file-versions', FileVersions);