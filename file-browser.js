import { LitElement, html, css } from 'lit-element';
import { repeat } from 'lit-html/directives/repeat.js';

import { initializeApp } from 'firebase/app';
import { GithubAuthProvider, getAuth, onAuthStateChanged, signOut, signInWithRedirect, getRedirectResult} from 'firebase/auth';

import 'ace-builds/src-noconflict/ace.js';
import 'ace-builds/src-noconflict/ext-modelist.js';
import 'ace-builds/src-noconflict/snippets/snippets.js';

import { Instant, LocalDateTime, DateTimeFormatter } from '@js-joda/core';

let jwt = null;

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
      user: { type: String, notify: true },
    };
  }

  constructor() {
    super();
    this.restURL = 'rest/';
    this.filePrefix = "/dev";
    this.context = '';
    this.data = {};
    this.path = ".";
    this.user;

    // Your web app's Firebase configuration
    var firebaseConfig = {
      apiKey: "AIzaSyCttqU-vwitkbeVA4-E4hFuNmV1WR32mKo",
      authDomain: "ccs-rest.firebaseapp.com",
      projectId: "ccs-rest",
      storageBucket: "ccs-rest.appspot.com",
      messagingSenderId: "393539384742",
      appId: "1:393539384742:web:700f0a54b0847572790b67"
    };

    this.firebaseApp = initializeApp(firebaseConfig);
    const auth = getAuth();
    onAuthStateChanged(auth, (user) => {
      if (user) {
        // User is signed in, see docs for a list of available properties
        // https://firebase.google.com/docs/reference/js/firebase.User
        this.user = user;
        user.getIdToken().then((token) => {
          jwt = token;
        });
        getRedirectResult(auth).then((result) => {
          // This gives you a GitHub Access Token. You can use it to access the GitHub API.
          if (result != null) {
            const credential = GithubAuthProvider.credentialFromResult(result);
            const token = credential.accessToken;
            // The signed-in user info.
            const user = result.user;
          }
          // ...
        }).catch((error) => {
          // Handle Errors here.
          const errorCode = error.code;
          const errorMessage = error.message;
          // The email of the user's account used.
          const email = error.email;
          // The AuthCredential type that was used.
          const credential = GithubAuthProvider.credentialFromError(error);
          // ...
        });
      } else {
        this.user = null;
        jwt == null;
      }
    });
  }

  render() {

    return html`
      ${this.user ? html`Hello ${this.user.displayName} <a @click=${this._logout} href="#">Logout</a>` : html`<a @click=${this._login} href="#">Login</a>`}
      <path-browser @path-changed=${this._pathChanged} path=${this.path}></path-browser>
      ${this.data.versionedFile ? this._renderVersionedFile(this.data) : this.data.children != null ? this._renderFolder(this.data) : this._renderFile(this.data)}
      `;
  }

  _login() {
    const auth = getAuth();
    const provider = new GithubAuthProvider();
    //provider.addScope('read:org');
    signInWithRedirect(auth, provider);
  }

  _logout() {
    const auth = getAuth();
    signOut(auth).then(() => {
      this.user = null;
    }).catch((error) => {
      // An error happened.
    });
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
      <file-versions restURL="${this.restURL}" path="${this.path}" name=${data.name} ?allowChanges=${this.user != null}></file-versions>
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
    ace.config.set('basePath', this.context + '/ace');
    this.path = window.location.pathname.replace(this.filePrefix, '.');
    if (this.path == "./") this.path = ".";
    this._updateData();
    window.onpopstate = (e) => {
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
    // Dragons: Browser incompatibility. Tested with chrome and firefox, apparently does not work with Safari
    let textContent = e.path ? e.path[0].textContent : e.originalTarget.textContent;
    let newPath = this.path + "/" + textContent
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
    // Dragons: Browser incompatibility. Tested with chrome and firefox, apparently does not work with Safari
    let index = e.path ? parseInt(e.path[0].id) : parseInt(e.originalTarget.id);
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
    this.fileChanged = false;
    this.loading = false;
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
    var modelist = ace.require("ace/ext/modelist");
    let mode = modelist.getModeForPath(this.name).mode;
    this.editor.session.setMode(mode);
    this.editor.renderer.attachToShadowRoot();
    this.editor.getSession().on('change', () => this._changed());
    this._load(this.fileURL);
  }

  _load(url) {
    this.loading = true;
    this.editor.setValue("Loading...");
    fetch(this.fileURL)
      .then(response => response.text())
      .then(text => {
        this.editor.setValue(text, -1);
        this.editor.session.getUndoManager().reset();
        this.fileChanged = false;
        this.loading = false;
      });
  }

  updated(changedProperties) {
    if (changedProperties.get("fileURL")) {
      this._load(this.fileURL);
    }
    if (changedProperties.get("readonly") != undefined) {
      this.editor.setReadOnly(this.readonly);
    }
  }

  postTo(url) {
    let text = this.editor.getValue();
    let headers = { 'Content-type': 'application/octet-stream' };
    if (jwt) headers['Authorization'] = 'Bearer '+jwt;
    return fetch(url, { method: 'POST', 'body': text, 'headers': headers })
      .then(response => response.json());
  }

  _changed() {
    if (!this.loading) {
      this.fileChanged = this.editor.session.getUndoManager().hasUndo();
      this._sendFileChangedEvent(this.fileChanged);
    }
  }

  _sendFileChangedEvent(fileChanged) {
    let event = new CustomEvent('file-changed', {
      detail: {
        isChanged: fileChanged
      }
    });
    this.dispatchEvent(event);
  }

  reset() {
    if (this.fileChanged) {
      this._load(this.fileURL);
      this._sendFileChangedEvent(false);
    }
  }

  focus() {
    this.editor.focus()
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
      fileChanged: { type: Boolean, notify: true },
      readOnly: { type: Boolean, notify: true },
      allowChanges: { type: Boolean, notify: true },
      showHidden: { type: Boolean, notify: true },
    };
  };

  constructor() {
    super();
    this.restURL = '';
    this.data = { "versions": [] };
    this.path = ".";
    this.selectedVersion = 'default';
    this.fileChanged = false;
    this.readOnly = true;
    this.allowChanges = false;
    this.showHidden = false;
  }

  render() {
    let dtf = new FileDateSizeFormatter();
    return html`
      <table>
        <thead>
          <tr><td colspan=3><input id="showHidden" type="checkbox" @click=${this._showHidden} ?checked=${this.showHidden}><label for="showHidden">Show Hidden</label></td></tr>
          <tr><th>Hidden</th><th>Default</th><th>Latest</th><th>Version</th><th>Size</th><th>Date</th><th>Download</th><th>Comment</th></tr>
        </thead>
        <tbody>
          ${repeat(this.data.versions, (row) => row.version, (row, index) => row.hidden && !this.showHidden ? null : html`
            <tr>
              <td><input type="checkbox" id="h${row.version}" @click=${this._hide} ?checked=${row.hidden} ?disabled=${row.version == this.data.latest || row.version == this.data.default || !this.allowChanges}></td>
              <td><input type="radio" name="default" id="d${row.version}" @click=${this._makeDefault} ?checked=${row.version == this.data.default} ?disabled=${row.hidden || !this.allowChanges}></td>
              <td><input type="radio" name="latest" id="l${row.version}" ?checked=${row.version == this.data.latest} ?disabled=${row.version != this.data.latest}></td>
              <td>${row.version}</td>
              <td>${dtf.humanFileSize(row.size)}</td>
              <td>${dtf.format(row.lastModified)}</td>
              <td>(<a href="${this.restURL + 'version/download/' + this.path + "?version=" + row.version}">download</a>)</td>
              <td><button id="b${row.version}" ?disabled=${!this.allowChanges} @click=${this._updateComment}>Update</button><input type="text" id="c${row.version}" value=${row.comment} ?disabled=${!this.allowChanges}></td>
            </tr>
          `)}
        </tbody>
      </table>
      Version: <select id="selectedVersion" @change=${this._selectionChanged} ?disabled=${!this.readOnly}>
        <option value="default" ?selected=${this.selectedVersion == "default"}>default</option>
        <option value="latest" ?selected=${this.selectedVersion == "latest"}>latest</option>
        ${repeat(this.data.versions, (row) => row.version, (row, index) => html`
          <option value=${row.version} ?selected=${this.selectedVersion == row.version}>${row.version}</option>
        `)}
        </select>

        ${this.allowChanges ? html`
          <button @click=${this._edit} ?disabled=${!this.readOnly}>Edit</button>
          <button @click=${this._cancel} ?disabled=${this.readOnly}>Cancel</button>
          <button @click=${this._save} ?disabled=${!this.fileChanged}>Save</button>
          <button>Diff Viewer (coming soon)</button>` : null}
        <ace-editor @file-changed=${this._fileChanged} ?readonly=${this.readOnly} name=${this.name} fileURL="${this.restURL + "version/download/" + this.path + "?version=" + (this.selectedVersion == "default" && this.data.default ? this.data.default : this.selectedVersion)}"></ace-editor>
    `;
  }

  firstUpdated(changedProperties) {
    this._updateData();
  }

  _updateData() {

    fetch(this.restURL + "version/info/" + this.path, {'method': 'GET', 'headers':  {'x-protocol-version': '2'}})
      .then(response => response.json())
      .then(versions => this.data = versions);
  }

  _selectionChanged() {
    let selection = this.shadowRoot.querySelector('#selectedVersion');
    this.selectedVersion = selection.value;
  }

  _getSelectedVersion(e) {
    // Dragons: Browser incompatibility. Tested with chrome and firefox, apparently does not work with Safari
    let id = e.path ? e.path[0].id : e.originalTarget.id;
    return id.substring(1);
  }

  _makeDefault(e) {
    let defaultVersion = this._getSelectedVersion(e);
    let options = {'version': defaultVersion, 'default': true};
    this._updateSettings(options);
  }

  _hide(e) {
    let version = this._getSelectedVersion(e);
    let hidden = this.data.versions[version-1].hidden;
    let options = {'version': version, 'hidden': !hidden};
    this._updateSettings(options);
  }

  _updateComment(e) {
    let version = this._getSelectedVersion(e);
    let comment = this.shadowRoot.querySelector("#c"+version).value;
    let options = {'version': version, 'comment': comment};
    this._updateSettings(options);
  }

  _updateSettings(options) {
    let headers = { 'Content-type': 'application/json; charset=UTF-8', 'x-protocol-version': '2' };
    if (jwt) headers['Authorization'] =  'Bearer '+jwt;
    fetch(this.restURL + "version/setOptions/" + this.path, { 'method': 'PUT', 'body': JSON.stringify(options), 'headers': headers })
      .then(response => response.json())
      .then(versions => this.data = versions);
  }

  _showHidden(e) {
    this.showHidden = !this.showHidden;
  }

  _edit() {
    this.readOnly = false;
    let editor = this.shadowRoot.querySelector("ace-editor");
    editor.readonly = false;
    editor.focus();
  }

  _cancel() {
    let editor = this.shadowRoot.querySelector("ace-editor");
    if (editor.fileChanged) {
      editor.reset();
    }
    editor.readonly = true;
    this.readOnly = true;
  }

  _fileChanged(e) {
    this.fileChanged = e.detail.isChanged;
  }

  _save() {
    let editor = this.shadowRoot.querySelector("ace-editor");
    editor.postTo(this.restURL + "version/upload/" + this.path).then((data) => this._updateData());
    this.fileChanged = false;
    editor.readonly = false;
    this.readOnly = true;
    this.selectedVersion = 'latest';
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