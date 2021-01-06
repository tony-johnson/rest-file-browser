import { LitElement, html, css } from 'lit-element';
import { repeat } from 'lit-html/directives/repeat.js';

import 'ace-builds/src-noconflict/ace.js';
import 'ace-builds/src-noconflict/ext-modelist.js';
import 'ace-builds/src-noconflict/snippets/snippets.js';

import { Instant, LocalDateTime, DateTimeFormatter } from '@js-joda/core';

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
      restURL: { type: String, notify: true },
      data: { type: Object, notify: true },
      path: { type: String, notify: true },
      filePrefix: { type: String, notify: true },
      context: { type: String, notify: true },
    };
  }

  constructor() {
    super();
    this.restURL = 'rest/';
    this.filePrefix = "/dev";
    this.context = '';
    this.data = {};
    this.path = ".";
  }

  render() {

    return html`
      <path-browser @path-changed=${this._pathChanged} path=${this.path}></path-browser>
      ${this.data.versionedFile ? this._renderVersionedFile(this.data) : this.data.children != null ? this._renderFolder(this.data) : this._renderFile(this.data)}
      `;

  }

  _renderFolder(data) {
    let dtf = new FileDateSizeFormatter();
    return html`
      <table>
        <thead>
          <th>Size</th><th>Date</th><th>File</th>
        </thead>
        <tbody>
        ${repeat(this.data.children, (row) => row.name, (row, index) => html`
          <tr class="file-list-element">
             <td class="size"></div>${dtf.humanFileSize(row.size, true)}</td>
             <td class="date">${dtf.format(row.lastModified)}</td>
             <td class="name"><a href="#" @click=${this._gotoFile}>${row.name}</a></td>
            </tr>
        `)}
        </tbody>
      </table>
    `;
  }

  _renderVersionedFile(data) {
    return html`
      <file-versions restURL="${this.restURL}" path="${this.path}" name=${data.name}></file-versions>
    `;
  }

  _renderFile(data) {
    let dtf = new FileDateSizeFormatter();
    return html`
      <p>Size: ${dtf.humanFileSize(data.size)} Date: ${dtf.format(data.lastModified)} Type: ${data.mimeType} (<a href="${this.restURL + 'download/' + this.path}">download</a>)</p>
      ${data.mimeType && data.mimeType.startsWith("text/") ? this._renderEditor(this.restURL + 'download/' + this.path, data.name) : null}
      ${data.mimeType && data.mimeType.startsWith("image/") ? this._renderImage(this.restURL + 'download/' + this.path) : null}
    `;
  }

  _renderEditor(url, name) {
    return html`
      <ace-editor readonly name=${name} fileURL=${url}></ace-editor>
    `;
  }

  _renderImage(url) {
    return html`
      <img src=${url}>
    `;
  }

  firstUpdated(changedProperties) {
    console.log(this.context);
    ace.config.set('basePath', this.context + '/ace');
    console.log(window.location.pathname);
    this.path = window.location.pathname.replace(this.filePrefix, '.');
    console.log(this.path);
    if (this.path == "./") this.path = ".";
    console.log(this.path);
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
    e.preventDefault();
    let newPath = this.path + "/" + e.path[0].textContent
    this._goto(newPath);
    window.history.pushState(newPath, 'Content', this.filePrefix + newPath.substring(1));
  }

  _pathChanged(e) {
    let newPath = e.detail.path
    this._goto(newPath);
    window.history.pushState(newPath, 'Content', this.filePrefix + newPath.substring(1));
  }

  _goto(path) {
    this.data = {};
    this.path = path;
    this._updateData();
  }

}

export class PathBrowser extends LitElement {
  static get styles() {
    return css`
      :host {
        display: inline;
      }
    `;
  }

  static get properties() {
    return {
      path: { type: String, notify: true },
    };
  }

  render() {

    let parts = this.path.split('/');
    const pathTemplates = [];
    parts.forEach((part, i, array) => {
      if (i == array.length - 1) {
        pathTemplates.push(html`${part}`);
      } else {
        pathTemplates.push(html`<a href='#' @click=${this._gotoPath} id=${i}>${part}</a>/`);
      }
    });

    return html`
      <h2>Path: ${pathTemplates}</h2>
      `;

  }

  _gotoPath(e) {
    let index = parseInt(e.path[0].id);
    let parts = this.path.split('/');

    let newPath = parts.slice(0, index + 1).join('/');
    e.preventDefault();
    let event = new CustomEvent('path-changed', {
      detail: {
        path: newPath
      }
    });
    this.dispatchEvent(event);
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
        }
    `;
  }

  static get properties() {
    return {
      fileURL: { type: String, notify: true },
      readonly: { type: Boolean, notify: true },
      name: { type: String, notify: true },
    };
  }

  constructor() {
    super();
    this.readonly = false;
  }

  render() {

    return html`
      <div id="editor"></div>
    `;
  }

  static get importMeta() { return import.meta; }

  firstUpdated(changedProperties) {
    let div = this.shadowRoot.getElementById('editor');
    this.editor = ace.edit(div, { readOnly: this.readonly });
    this.editor.setValue("Loading...");
    var modelist = ace.require("ace/ext/modelist");
    let mode = modelist.getModeForPath(this.name).mode;
    console.log(mode);
    this.editor.session.setMode(mode);
    this.editor.renderer.attachToShadowRoot();
    fetch(this.fileURL)
      .then(response => response.text())
      .then(text => this.editor.setValue(text, -1));
  }

  updated(changedProperties) {
    if (changedProperties.get("fileURL")) {
      this.editor.setValue("Loading...");
      fetch(this.fileURL)
        .then(response => response.text())
        .then(text => this.editor.setValue(text, -1));
    } else if (changedProperties.get("readonly")) {
      this.editor.setOption("readOnly", this.readonly);
    }
  }

  postTo(url) {
    let text = this.editor.getValue();
    return fetch(url, { method: 'POST', body: text, headers: { 'Content-type': 'application/octet-stream' } })
      .then(response => response.json());
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
      name: { type: String, notify: true },
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
    let dtf = new FileDateSizeFormatter();
    return html`
      <table>
        <thead>
          <th>Version</th><th>Size</th><th>Date</th><th></th>
        </thead>
        <tbody>
          ${repeat(this.data.versions, (row) => row.version, (row, index) => html`
            <tr>
              <td>${row.version}</td>
              <td>${dtf.humanFileSize(row.size)}</td>
              <td>${dtf.format(row.lastModified)}</td>
              <td>
            ${row.version == this.data.latest ? html`<b>latest</b>` : null}
            ${row.version == this.data.default ? html`<b>default</b>` : html`<button id=${row.version} @click=${this._makeDefault}>Make Default</button>`}
            (<a href="${this.restURL + 'version/download/' + this.path + "?version=" + row.version}">download</a>)
              </td>
            </tr>
          `)}
        </tbody>
      </table>
      Version: <select id="selectedVersion" @change=${this._selectionChanged}>
        <option value="default" ?selected=${this.selectedVersion == "default"}>default</option>
        <option value="latest" ?selected=${this.selectedVersion == "latest"}>latest</option>
        ${repeat(this.data.versions, (row) => row.version, (row, index) => html`
          <option value=${row.version} ?selected=${this.selectedVersion == row.version}>${row.version}</option>
        `)}
        </select><button @click=${this._edit}>Edit</button><button @click=${this._save}>Save</button><button>Diff Viewer</button>
        <ace-editor readonly name=${this.name} fileURL="${this.restURL + "version/download/" + this.path + "?version=" + (this.selectedVersion == "default" && this.data.default ? this.data.default : this.selectedVersion)}"></ace-editor>
    `;
  }

  firstUpdated(changedProperties) {
    this._updateData();
  }

  _updateData() {
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
    fetch(this.restURL + "version/set/" + this.path, { method: 'PUT', body: JSON.stringify(defaultId), headers: { 'Content-type': 'application/json; charset=UTF-8' } })
      .then(response => response.json())
      .then(versions => this.data = versions);
  }

  _edit() {
    let editor = this.shadowRoot.querySelector("ace-editor");
    editor.readonly = false;
  }


  _save() {
    let editor = this.shadowRoot.querySelector("ace-editor");
    editor.postTo(this.restURL + "version/upload/" + this.path).then((data) => this._updateData());
  }
}


class FileDateSizeFormatter {

  constructor() {
    this.referenceTime = Instant.now();
  }

  format(epochMillis) {
    if (epochMillis == null) return "";
    let timeStamp = Instant.ofEpochMilli(epochMillis);
    //let age = Duration.between(this.referenceTime, timeStamp);
    let formatter = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm");
    return LocalDateTime.ofInstant(timeStamp).format(formatter);
  }

  /**
 * Format bytes as human-readable text.
 *
 * @param bytes Number of bytes.
 * @param si True to use metric (SI) units, aka powers of 1000. False to use
 *           binary (IEC), aka powers of 1024.
 * @param dp Number of decimal places to display.
 *
 * @return Formatted string.
 */
  humanFileSize(bytes, si = false, dp = 1) {
    const thresh = si ? 1000 : 1024;

    if (Math.abs(bytes) < thresh) {
      return bytes;
    }

    const units = si
      ? ['k', 'M', 'G', 'T', 'P', 'E', 'Z', 'Y']
      : ['KiB', 'MiB', 'GiB', 'TiB', 'PiB', 'EiB', 'ZiB', 'YiB'];
    let u = -1;
    const r = 10 ** dp;

    do {
      bytes /= thresh;
      ++u;
    } while (Math.round(Math.abs(bytes) * r) / r >= thresh && u < units.length - 1);


    return bytes.toFixed(dp) + units[u];
  }
}

window.customElements.define('file-browser', FileBrowser);
window.customElements.define('path-browser', PathBrowser);
window.customElements.define('ace-editor', AceEditor);
window.customElements.define('file-versions', FileVersions);