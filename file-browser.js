import { LitElement, html, css } from 'lit-element';
import { repeat } from 'lit-html/directives/repeat.js';

import { initializeApp } from 'firebase/app';
import { GithubAuthProvider, getAuth, onAuthStateChanged, signOut, signInWithPopup, getRedirectResult} from 'firebase/auth';

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
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 14px;
        color: #222;
      }
      a { color: #1a73e8; text-decoration: none; }
      a:hover { text-decoration: underline; }
      .user-bar {
        font-size: 13px;
        color: #555;
        margin-bottom: 12px;
      }
      button {
        font-family: inherit;
        font-size: 13px;
        padding: 4px 12px;
        border: 1px solid #ccc;
        border-radius: 4px;
        background: #f8f8f8;
        cursor: pointer;
        color: #333;
      }
      button:hover:not(:disabled) { background: #e8e8e8; border-color: #aaa; }
      button:disabled { opacity: 0.45; cursor: default; }
      .error-banner {
        background: #fdd;
        border: 1px solid #c00;
        color: #c00;
        padding: 6px 10px;
        margin-bottom: 8px;
        border-radius: 4px;
        font-size: 13px;
      }
      .error-banner button { margin-left: 8px; }
      table {
        border-collapse: collapse;
        width: 100%;
        margin-bottom: 10px;
      }
      th {
        background: #f0f2f5;
        border-bottom: 2px solid #d0d4da;
        padding: 6px 10px;
        text-align: left;
        font-weight: 600;
        font-size: 12px;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        color: #555;
      }
      td {
        padding: 5px 10px;
        border-bottom: 1px solid #eee;
        vertical-align: middle;
      }
      tr:last-child td { border-bottom: none; }
      tbody tr:hover { background: #f5f8ff; }
      td.size { color: #777; font-size: 12px; white-space: nowrap; }
      td.date { color: #777; font-size: 12px; white-space: nowrap; }
      td.name { width: 50%; }
      td.name a { font-weight: 500; }
      .show-hidden-row td { border-bottom: 1px solid #e0e4ea; background: #fafbfc; }
      .toolbar {
        display: flex;
        gap: 6px;
        align-items: center;
        margin: 10px 0 6px;
      }
      .dialog-overlay {
        position: fixed;
        inset: 0;
        background: rgba(0,0,0,0.45);
        z-index: 1000;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .dialog-card {
        background: white;
        padding: 24px;
        min-width: 640px;
        max-width: 90vw;
        border-radius: 8px;
        box-shadow: 0 8px 32px rgba(0,0,0,0.25);
      }
      .dialog-card h3 { margin: 0 0 16px; font-size: 17px; }
      .dialog-field { margin-bottom: 12px; }
      .dialog-field label { font-size: 13px; color: #444; }
      .dialog-field input[type=text] {
        margin-left: 6px;
        padding: 4px 8px;
        border: 1px solid #ccc;
        border-radius: 4px;
        font-size: 13px;
        width: 280px;
      }
      .dialog-buttons { margin-top: 12px; display: flex; gap: 6px; }
      .btn-primary {
        background: #1a73e8;
        color: white;
        border-color: #1a73e8;
      }
      .btn-primary:hover:not(:disabled) { background: #1558b0; border-color: #1558b0; }
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
      showNewFileDialog: { type: Boolean, notify: true },
      newFileName: { type: String, notify: true },
      newFileVersioned: { type: Boolean, notify: true },
      serverInfo: { type: Object, notify: true },
      showHidden: { type: Boolean, notify: true },
      errorMessage: { type: String, notify: true },
      showConfigExplorer: { type: Boolean, notify: true },
    };
  }

  constructor() {
    super();
    this.restURL = 'rest/';
    this.filePrefix = "";
    this.context = '';
    this.data = {};
    this.path = ".";
    this.user;
    this.showNewFileDialog = false;
    this.newFileName = '';
    this.newFileVersioned = true;
    this.serverInfo = { version: '1.0', capabilities: ['versionComments'] };
    this.showHidden = false;
    this.errorMessage = '';
    this.showConfigExplorer = false;

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
          console.log(error.code)
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
      ${this.errorMessage ? html`<div class="error-banner">${this.errorMessage} <button @click=${() => this.errorMessage = ''}>✕</button></div>` : null}
      <div class="user-bar">${this.user ? html`Hello ${this.user.displayName} <a @click=${this._logout} href="#">Logout</a>` : html`<a @click=${this._login} href="#">Login</a>`}</div>
      <path-browser @path-changed=${this._pathChanged} path=${this.path}></path-browser>
      ${this.showConfigExplorer
        ? html`<config-explorer path=${this.path} restURL=${this.restURL} @back=${() => this.showConfigExplorer = false}></config-explorer>`
        : this.data.versionedFile ? this._renderVersionedFile(this.data) : this.data.children != null ? this._renderFolder(this.data) : this._renderFile(this.data)}
      ${this.showNewFileDialog ? this._renderNewFileDialog() : null}
      `;
  }

  _login() {
    console.log("Login")
    const auth = getAuth();
    const provider = new GithubAuthProvider();
    //provider.addScope('read:org');
    signInWithPopup(auth, provider);
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
    const canHide = this.serverInfo.capabilities.includes('hideFiles');
    const hasHidden = canHide && (this.data.hasHidden || this.data.children.some(r => r.hidden));
    return html`
      <table>
        <thead>
          ${canHide ? html`
            <tr><td colspan=4>
              <input id="showHidden" type="checkbox" @click=${() => { this.showHidden = !this.showHidden; this._updateData(); }}
                ?checked=${this.showHidden} ?disabled=${!hasHidden}
                style=${!hasHidden ? 'opacity:0.4' : ''}>
              <label for="showHidden" style=${!hasHidden ? 'opacity:0.4' : ''}>Show Hidden</label>
            </td></tr>
            <tr><th>Hidden</th><th>Size</th><th>Date</th><th>File</th></tr>
          ` : html`
            <tr><th>Size</th><th>Date</th><th>File</th></tr>
          `}
        </thead>
        <tbody>
        ${repeat(this.data.children, (row) => row.name, (row, index) => row.hidden && !this.showHidden ? null : html`
          <tr class="file-list-element">
            ${canHide ? html`
              <td><input type="checkbox" @click=${(e) => this._hideEntry(e, row)}
                ?checked=${row.hidden} ?disabled=${this.user == null}></td>
            ` : null}
            <td class="size">${dtf.humanFileSize(row.size, true)}</td>
            <td class="date">${dtf.format(row.lastModified)}</td>
            <td class="name"><a href="#" @click=${this._gotoFile}>${row.name}</a></td>
          </tr>
        `)}
        </tbody>
      </table>
      <div class="toolbar">
        <button @click=${this._addFolder} ?disabled=${this.user == null}>Add Folder</button>
        <button @click=${this._openNewFileDialog} ?disabled=${this.user == null}>Add File</button>
        ${this._isConfigDirectory(data) ? html`<button @click=${this._openConfigExplorer}>Configuration Explorer</button>` : null}
      </div>
    `;
  }

  _isConfigDirectory(data) {
    return data.children && data.children.length > 0 &&
      data.children.every(c => c.name.endsWith('.properties'));
  }

  _openConfigExplorer() {
    this.showConfigExplorer = true;
  }

  _renderVersionedFile(data) {
    return html`
      <file-versions restURL="${this.restURL}" path="${this.path}" name=${data.name} ?allowChanges=${this.user != null} .serverInfo=${this.serverInfo}></file-versions>
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
    const pathname = window.location.pathname;
    const stripped = pathname.startsWith(this.filePrefix)
      ? '.' + pathname.slice(this.filePrefix.length)
      : '.';
    this.path = stripped === './' ? '.' : stripped;
    fetch(this.restURL + 'serverInfo')
      .then(response => {
        if (!response.ok) throw new Error('not found');
        return response.json();
      })
      .then(info => { this.serverInfo = info; })
      .catch(() => { this.serverInfo = { version: '1.0', capabilities: ['versionComments'] }; })
      .finally(() => this._updateData());
    window.onpopstate = (e) => {
      this._goto(e.state == null ? "." : e.state);
    };
  }

  _updateData() {
    const url = this.restURL + "list/" + this.path + (this.showHidden ? '?showHidden=true' : '');
    fetch(url)
      .then(response => {
        if (!response.ok) throw new Error(`Failed to load folder (${response.status})`);
        return response.json();
      })
      .then(data => this.data = data)
      .catch(e => this.errorMessage = e.message);
  }

  _gotoFile(e) {
    e.preventDefault();
    // Dragons: Browser incompatibility. Tested with chrome and firefox, apparently does not work with Safari
    let textContent = e.path ? e.path[0].textContent : e.currentTarget.textContent;
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
    this.showConfigExplorer = false;
    this._updateData();
  }

  _upload(e) {
    e.preventDefault();
    let fileSelector = this.shadowRoot.querySelector("#upload");
    fetch(this.restURL + "version/upload" + this.path + fileSelector.textContent)
    console.log(e);
  }

  _addFolder(e) {
    const name = window.prompt('Folder name:');
    if (!name) return;
    const path = this.path === '.' ? name : this.path + '/' + name;
    const headers = {};
    if (jwt) headers['Authorization'] = 'Bearer ' + jwt;
    fetch(this.restURL + 'createDirectory/' + path, { method: 'POST', headers })
      .then(response => {
        if (!response.ok) throw new Error(`Failed to create folder (${response.status})`);
      })
      .then(() => this._updateData())
      .catch(e => this.errorMessage = e.message);
  }

  _hideEntry(e, row) {
    const entryPath = this.path === '.' ? row.name : this.path + '/' + row.name;
    const headers = { 'Content-type': 'application/json; charset=UTF-8' };
    if (jwt) headers['Authorization'] = 'Bearer ' + jwt;
    const options = { hidden: !row.hidden };
    fetch(this.restURL + 'setOptions/' + entryPath, { method: 'PUT', body: JSON.stringify(options), headers })
      .then(response => {
        if (!response.ok) throw new Error(`Failed to update entry (${response.status})`);
      })
      .then(() => this._updateData())
      .catch(e => this.errorMessage = e.message);
  }

  _openNewFileDialog() {
    this.newFileName = '';
    this.newFileVersioned = true;
    this.showNewFileDialog = true;
  }

  _closeNewFileDialog() {
    this.showNewFileDialog = false;
  }

  _renderNewFileDialog() {
    return html`
      <div class="dialog-overlay">
        <div class="dialog-card">
          <h3>New File</h3>
          <div class="dialog-field">
            <label>Name: <input type="text" .value=${this.newFileName} @input=${e => this.newFileName = e.target.value}></label>
          </div>
          <div class="dialog-field">
            <label><input type="checkbox" ?checked=${this.newFileVersioned} @change=${e => this.newFileVersioned = e.target.checked}> Versioned</label>
          </div>
          <ace-editor id="newFileEditor" name=${this.newFileName || 'untitled'}></ace-editor>
          <div class="dialog-buttons">
            <button class="btn-primary" @click=${this._saveNewFile} ?disabled=${!this.newFileName}>Save</button>
            <button @click=${this._uploadToNewFileEditor}>Upload</button>
            <button @click=${this._closeNewFileDialog}>Cancel</button>
          </div>
          <input type="file" id="newFileUploadInput" style="display:none" @change=${this._newFileUploadSelected}>
        </div>
      </div>
    `;
  }

  _uploadToNewFileEditor() {
    this.shadowRoot.querySelector('#newFileUploadInput').click();
  }

  _newFileUploadSelected(e) {
    const file = e.target.files[0];
    if (!file) return;
    if (!this.newFileName) this.newFileName = file.name;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const editor = this.shadowRoot.querySelector('#newFileEditor');
      editor.editor.setValue(evt.target.result, -1);
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  _saveNewFile() {
    const editor = this.shadowRoot.querySelector('#newFileEditor');
    const content = editor.getContent();
    const path = this.path === '.' ? this.newFileName : this.path + '/' + this.newFileName;
    const url = this.newFileVersioned
      ? this.restURL + 'version/upload/' + path
      : this.restURL + 'upload/' + path;
    const headers = { 'Content-type': 'application/octet-stream' };
    if (jwt) headers['Authorization'] = 'Bearer ' + jwt;
    fetch(url, { method: 'POST', body: content, headers })
      .then(response => {
        if (!response.ok) throw new Error(`Failed to save file (${response.status})`);
      })
      .then(() => {
        this._closeNewFileDialog();
        this._updateData();
      })
      .catch(e => this.errorMessage = e.message);
  }

}

export class PathBrowser extends LitElement {
  static get styles() {
    return css`
      :host {
        display: inline;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      }
      h2 {
        font-size: 15px;
        font-weight: 600;
        color: #333;
        margin: 0 0 12px;
      }
      a { color: #1a73e8; text-decoration: none; }
      a:hover { text-decoration: underline; }
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
    let index = e.path ? parseInt(e.path[0].id) : parseInt(e.currentTarget.id);
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
          height: 100%;
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
    if (this.fileURL) this._load(this.fileURL);
  }

  _load(url) {
    this.loading = true;
    this.editor.setValue("Loading...");
    fetch(this.fileURL)
      .then(response => response.text())
      .then(text => {
        this.editor.setValue(text, -1);
        this.editor.session.getUndoManager().reset();
        this.loading = false;
        this.fileChanged = false;
        this._sendFileChangedEvent(false);
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
      .then(response => {
        if (!response.ok) throw new Error(`Failed to save file (${response.status})`);
        return response.json();
      });
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

  getContent() {
    return this.editor ? this.editor.getValue() : '';
  }

}

export class FileVersions extends LitElement {
  static get styles() {
    return css`
      :host {
        display: block;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 14px;
        color: #222;
      }
      a { color: #1a73e8; text-decoration: none; }
      a:hover { text-decoration: underline; }
      button {
        font-family: inherit;
        font-size: 13px;
        padding: 4px 12px;
        border: 1px solid #ccc;
        border-radius: 4px;
        background: #f8f8f8;
        cursor: pointer;
        color: #333;
      }
      button:hover:not(:disabled) { background: #e8e8e8; border-color: #aaa; }
      button:disabled { opacity: 0.45; cursor: default; }
      .btn-primary {
        background: #1a73e8;
        color: white;
        border-color: #1a73e8;
      }
      .btn-primary:hover:not(:disabled) { background: #1558b0; border-color: #1558b0; }
      .error-banner {
        background: #fdd;
        border: 1px solid #c00;
        color: #c00;
        padding: 6px 10px;
        margin-bottom: 8px;
        border-radius: 4px;
        font-size: 13px;
      }
      .error-banner button { margin-left: 8px; }
      table {
        border-collapse: collapse;
        width: 100%;
        margin-bottom: 8px;
      }
      th {
        background: #f0f2f5;
        border-bottom: 2px solid #d0d4da;
        padding: 6px 10px;
        text-align: left;
        font-weight: 600;
        font-size: 12px;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        color: #555;
      }
      td {
        padding: 5px 8px;
        border-bottom: 1px solid #eee;
        vertical-align: middle;
        white-space: nowrap;
      }
      tr:last-child td { border-bottom: none; }
      tbody tr:hover { background: #f5f8ff; }
      td.ctrl { width: 24px; text-align: center; }
      td.version-num { width: 40px; font-weight: 600; }
      td.size-col { color: #777; font-size: 12px; }
      td.date-col { color: #777; font-size: 12px; }
      td.creator-col { max-width: 160px; overflow: hidden; text-overflow: ellipsis; color: #555; font-size: 12px; }
      td.comment-col { white-space: normal; width: 100%; }
      td.comment-col > div { display: flex; align-items: center; }
      td.comment-col input[type=text] {
        flex: 1 1 0;
        min-width: 0;
        padding: 3px 6px;
        border: 1px solid #ddd;
        border-radius: 3px;
        font-size: 12px;
        font-family: inherit;
      }
      td.comment-col input[type=text]:focus { border-color: #1a73e8; outline: none; }
      td.comment-col button {
        padding: 3px 8px;
        font-size: 12px;
        margin-right: 4px;
      }
      .show-hidden-row td { padding: 4px 8px; background: #fafbfc; }
      select {
        font-family: inherit;
        font-size: 13px;
        padding: 3px 6px;
        border: 1px solid #ccc;
        border-radius: 4px;
        background: #fff;
      }
      .toolbar {
        display: flex;
        gap: 6px;
        align-items: center;
        margin: 8px 0;
        flex-wrap: wrap;
      }
      .toolbar label { font-size: 13px; color: #444; }
      .editing-banner {
        margin: 8px 0;
        padding: 8px 12px;
        border-radius: 4px;
        font-size: 13px;
        display: flex;
        align-items: center;
        gap: 10px;
        flex-wrap: wrap;
      }
      .editing-banner.is-latest {
        background: #e8f5e9;
        border: 1px solid #a5d6a7;
      }
      .editing-banner.is-stale {
        background: #fff3e0;
        border: 1px solid #ffcc80;
      }
      .editing-banner input[type=text] {
        padding: 3px 8px;
        border: 1px solid #ccc;
        border-radius: 4px;
        font-size: 13px;
        font-family: inherit;
        width: 260px;
      }
      .editing-banner input[type=text]:focus { border-color: #1a73e8; outline: none; }
      .history-panel { margin-bottom: 8px; }
      .history-panel table { width: auto; }
      #diffViewer { margin-top: 8px; }
      #diffViewer .toolbar { margin-bottom: 6px; }
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
      showDiff:{type:Boolean,notify: true},
      diffVersion1:{type:String,notify: true},
      diffVersion2:{type:String,notify: true},
      newComment:{type:String,notify: true},
      editingVersion:{type:String,notify: true},
      showEditDiff:{type:Boolean,notify: true},
      showDefaultHistory:{type:Boolean,notify: true},
      serverInfo:{type:Object,notify: true},
      errorMessage:{type:String,notify: true},
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
    this.newComment = '';
    this.editingVersion = null;
    this.showEditDiff = false;
    this.showDefaultHistory = false;
    this.serverInfo = { version: '1.0', capabilities: ['versionComments'] };
    this.errorMessage = '';
  }

  render() {
    let dtf = new FileDateSizeFormatter();
    return html`
      ${this.errorMessage ? html`<div class="error-banner">${this.errorMessage} <button @click=${() => this.errorMessage = ''}>✕</button></div>` : null}
      <table>
        <thead>
          <tr class="show-hidden-row"><td colspan=9><input id="showHidden" type="checkbox" @click=${this._showHidden} ?checked=${this.showHidden} ?disabled=${!this.data.versions.some(v => v.hidden)} style=${!this.data.versions.some(v => v.hidden) ? 'opacity:0.4' : ''}><label for="showHidden" style=${!this.data.versions.some(v => v.hidden) ? 'opacity:0.4' : ''}> Show Hidden</label></td></tr>
          <tr><th>Hidden</th><th>Default</th><th>Latest</th><th>Version</th><th>Size</th><th>Date</th><th>Creator</th><th>Download</th><th>Comment</th></tr>
        </thead>
        <tbody>
          ${repeat(this.data.versions, (row) => row.version, (row, index) => row.hidden && !this.showHidden ? null : html`
            <tr>
              <td class="ctrl"><input type="checkbox" id="h${row.version}" @click=${this._hide} ?checked=${row.hidden} ?disabled=${row.version == this.data.latest || row.version == this.data.default || !this.allowChanges}></td>
              <td class="ctrl"><input type="radio" name="default" id="d${row.version}" @click=${this._makeDefault} ?checked=${row.version == this.data.default} ?disabled=${row.hidden || !this.allowChanges}></td>
              <td class="ctrl"><input type="radio" name="latest" id="l${row.version}" ?checked=${row.version == this.data.latest} ?disabled=${row.version != this.data.latest}></td>
              <td class="version-num">${row.version}</td>
              <td class="size-col">${dtf.humanFileSize(row.size)}</td>
              <td class="date-col">${dtf.format(row.lastModified)}</td>
              <td class="creator-col">${row.creator || ''}</td>
              <td><a href="${this.restURL + 'version/download/' + this.path + "?version=" + row.version}">download</a></td>
              <td class="comment-col"><div><button id="b${row.version}" ?disabled=${!this.allowChanges} @click=${this._updateComment}>Update</button><input type="text" id="c${row.version}" value=${row.comment} ?disabled=${!this.allowChanges} @blur=${this._updateComment} @keydown=${e => e.key === 'Enter' && this._updateComment(e)}></div></td>
            </tr>
          `)}
        </tbody>
      </table>
      ${this.data.defaultHistory && this.data.defaultHistory.length ? html`
        <div class="history-panel">
          <button @click=${() => this.showDefaultHistory = !this.showDefaultHistory}>
            Default History ${this.showDefaultHistory ? '▲' : '▼'}
          </button>
          ${this.showDefaultHistory ? html`
            <table>
              <thead><tr><th>Date</th><th>Version</th><th>Changed By</th></tr></thead>
              <tbody>
                ${repeat(this.data.defaultHistory, (row) => row.timestamp, (row) => html`
                  <tr>
                    <td class="date-col">${dtf.format(row.timestamp)}</td>
                    <td class="version-num">${row.version}</td>
                    <td class="creator-col">${row.changedBy || ''}</td>
                  </tr>
                `)}
              </tbody>
            </table>
          ` : ''}
        </div>
      ` : ''}
      ${this.showDiff ? html`
        <div id="diffViewer">
          <div class="toolbar">
            Diff Viewer:
            <select id="diffV1" @change=${this._diffSelectionChanged} data-side="v1">
              ${repeat(this.data.versions, (t) => t.version, (t,i) => t.hidden && !this.showHidden ? null : html`<option value=${t.version} ?selected=${this.diffVersion1==t.version}>${t.version}</option>`)}
            </select>
            <button type="button" class="diff-swap" @click=${this._swapDiffVersions} title="Swap diff selections">⇄</button>
            <select id="diffV2" @change=${this._diffSelectionChanged} data-side="v2">
              ${repeat(this.data.versions, (t) => t.version, (t,i) => t.hidden && !this.showHidden ? null : html`<option value=${t.version} ?selected=${this.diffVersion2==t.version}>${t.version}</option>`)}
            </select>
            <button @click=${this._closeDiff}>Close</button>
          </div>
          <ace-editor readonly name="diff.diff" fileURL="${this.restURL+"version/diff/"+this.path+"?v2="+this.diffVersion1+"&v1="+this.diffVersion2}"></ace-editor>
        </div>` : html`
        <div class="toolbar">
          <label>Version:</label>
          <select id="selectedVersion" @change=${this._selectionChanged} ?disabled=${!this.readOnly}>
            <option value="default" ?selected=${this.selectedVersion == "default"}>default</option>
            <option value="latest" ?selected=${this.selectedVersion == "latest"}>latest</option>
            ${repeat(this.data.versions, (row) => row.version, (row, index) => row.hidden && !this.showHidden ? null : html`
              <option value=${row.version} ?selected=${this.selectedVersion == row.version}>${row.version}</option>
            `)}
          </select>
          ${this.allowChanges ? html`
            <button class="btn-primary" @click=${this._edit} ?disabled=${!this.readOnly}>Edit</button>
            <button @click=${this._cancel} ?disabled=${this.readOnly}>Cancel</button>
            <button class="btn-primary" @click=${this._save} ?disabled=${!this.fileChanged}>Save</button>` : null}
          <button @click=${this.readOnly ? this._showDiff : this._showEditDiff} ?disabled=${this.readOnly ? this.data.versions.filter((t) => !t.hidden).length < 2 : this.showEditDiff}>
            Diff Viewer
          </button>
        </div>
        ${!this.readOnly ? this._renderEditingBanner() : null}
        ${this.showEditDiff ? this._renderEditDiff() : null}
        <ace-editor @file-changed=${this._fileChanged} ?readonly=${this.readOnly} name=${this.name} fileURL="${this.restURL + "version/download/" + this.path + "?version=" + (this.selectedVersion == "default" && this.data.default ? this.data.default : this.selectedVersion)}"></ace-editor>
      `}
    `;
  }
  _renderEditingBanner() {
    const effectiveVersion = this.selectedVersion === 'default' && this.data.default
      ? this.data.default
      : this.selectedVersion === 'latest' && this.data.latest
        ? this.data.latest
        : this.selectedVersion;
    const isLatest = String(effectiveVersion) === String(this.data.latest);
    return html`
      <div class="editing-banner ${isLatest ? 'is-latest' : 'is-stale'}">
        <span>Editing version ${effectiveVersion}${isLatest ? '' : html` &mdash; <strong>warning:</strong> not the latest (latest is ${this.data.latest})`}</span>
        <label>Comment: <input type="text" .value=${this.newComment} @input=${e => this.newComment = e.target.value} placeholder="(none)"></label>
      </div>`;
  }

  firstUpdated(changedProperties) {
    this._updateData();
  }

  _updateData() {
    fetch(this.restURL + "version/info/" + this.path, {'method': 'GET', 'headers':  {'x-protocol-version': '2'}})
      .then(response => {
        if (!response.ok) throw new Error(`Failed to load version info (${response.status})`);
        return response.json();
      })
      .then(versions => this.data = versions)
      .catch(e => this.errorMessage = e.message);
  }

  _selectionChanged() {
    let selection = this.shadowRoot.querySelector('#selectedVersion');
    this.selectedVersion = selection.value;
  }

  _getSelectedVersion(e) {
    // Dragons: Browser incompatibility. Tested with chrome and firefox, apparently does not work with Safari
    let id = e.path ? e.path[0].id : e.currentTarget.id;
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
      .then(response => {
        if (!response.ok) throw new Error(`Failed to update settings (${response.status})`);
        return response.json();
      })
      .then(versions => this.data = versions)
      .catch(e => this.errorMessage = e.message);
  }

  _showHidden(e) {
    this.showHidden = !this.showHidden;
  }

  _edit() {
    this.newComment = '';
    this.showEditDiff = false;
    this.editingVersion = this.selectedVersion === 'default' && this.data.default
      ? String(this.data.default)
      : this.selectedVersion === 'latest' && this.data.latest
        ? String(this.data.latest)
        : this.selectedVersion;
    this.readOnly = false;
    let editor = this.shadowRoot.querySelector("ace-editor");
    editor.readonly = false;
    editor.focus();
  }

  _cancel() {
    let editor = this.shadowRoot.querySelector('ace-editor:not(#editDiffEditor)');
    if (editor.fileChanged) {
      editor.reset();
    }
    editor.readonly = true;
    this.readOnly = true;
    this.fileChanged = false;
    this.showEditDiff = false;
  }

  _showEditDiff() {
    this.showEditDiff = !this.showEditDiff;
    if (this.showEditDiff) this._refreshEditDiff();
  }

  _refreshEditDiff() {
    const editor = this.shadowRoot.querySelector('ace-editor:not(#editDiffEditor)');
    const currentText = editor ? editor.editor.getValue() : '';
    fetch(this.restURL + 'version/download/' + this.path + '?version=' + this.editingVersion)
      .then(r => {
        if (!r.ok) throw new Error(`Failed to load version ${this.editingVersion} (${r.status})`);
        return r.text();
      })
      .then(originalText => {
        const patch = this._createUnifiedDiff('version ' + this.editingVersion, 'current edits', originalText, currentText);
        const diffEditor = this.shadowRoot.querySelector('#editDiffEditor');
        if (diffEditor) {
          diffEditor.loading = true;
          diffEditor.editor.setValue(patch, -1);
          diffEditor.editor.session.getUndoManager().reset();
          diffEditor.loading = false;
        }
      })
      .catch(e => this.errorMessage = e.message);
  }

  _createUnifiedDiff(oldName, newName, oldText, newText) {
    const oldLines = oldText.split('\n');
    const newLines = newText.split('\n');
    // Build LCS-based edit script
    const m = oldLines.length, n = newLines.length;
    const dp = Array.from({length: m + 1}, () => new Array(n + 1).fill(0));
    for (let i = m - 1; i >= 0; i--)
      for (let j = n - 1; j >= 0; j--)
        dp[i][j] = oldLines[i] === newLines[j] ? dp[i+1][j+1] + 1 : Math.max(dp[i+1][j], dp[i][j+1]);
    // Walk edit script into hunks
    const CONTEXT = 3;
    const edits = [];
    let i = 0, j = 0;
    while (i < m || j < n) {
      if (i < m && j < n && oldLines[i] === newLines[j]) {
        edits.push({type: ' ', line: oldLines[i], oi: i, ni: j});
        i++; j++;
      } else if (j < n && (i >= m || dp[i][j+1] >= dp[i+1][j])) {
        edits.push({type: '+', line: newLines[j], oi: i, ni: j});
        j++;
      } else {
        edits.push({type: '-', line: oldLines[i], oi: i, ni: j});
        i++;
      }
    }
    // Group into hunks with context
    const changed = edits.map((e, idx) => e.type !== ' ' ? idx : -1).filter(x => x >= 0);
    if (!changed.length) return `--- ${oldName}\n+++ ${newName}\n(no differences)`;
    const hunks = [];
    let hunk = null;
    for (const ci of changed) {
      const start = Math.max(0, ci - CONTEXT), end = Math.min(edits.length - 1, ci + CONTEXT);
      if (!hunk || start > hunk.end + 1) {
        if (hunk) hunks.push(hunk);
        hunk = {start, end, indices: []};
      } else {
        hunk.end = Math.max(hunk.end, end);
      }
      hunk.indices.push(ci);
    }
    if (hunk) hunks.push(hunk);
    const lines = [`--- ${oldName}`, `+++ ${newName}`];
    for (const h of hunks) {
      const slice = edits.slice(h.start, h.end + 1);
      const oldStart = (slice.find(e => e.type !== '+') || slice[0]).oi + 1;
      const newStart = (slice.find(e => e.type !== '-') || slice[0]).ni + 1;
      const oldCount = slice.filter(e => e.type !== '+').length;
      const newCount = slice.filter(e => e.type !== '-').length;
      lines.push(`@@ -${oldStart},${oldCount} +${newStart},${newCount} @@`);
      for (const e of slice) lines.push(e.type + e.line);
    }
    return lines.join('\n');
  }

  _renderEditDiff() {
    return html`
      <div style="margin:0.5em 0">
        <span>Diff vs saved version ${this.editingVersion}</span>
        <button @click=${this._refreshEditDiff} style="margin-left:0.5em">Refresh</button>
        <button @click=${() => this.showEditDiff = false} style="margin-left:0.5em">Close</button>
        <ace-editor id="editDiffEditor" readonly name="diff.diff"></ace-editor>
      </div>`;
  }

  _showDiff() {
    let t=this.data.versions.filter(t=>!t.hidden);
    if(t.length>1){
      this.diffVersion2=String(this.data.latest);
      if (this.data.default && this.data.default!=this.data.latest && !this.data.versions[this.data.default-1].hidden) {
        this.diffVersion1=String(this.data.default);
      } else {
        let i = t.findIndex(e => e.version == this.data.latest);
        this.diffVersion1 = i > 0 ? String(t[i-1].version) : String(this.data.latest);
      }
      this.showDiff = true;
    }
  }

  _closeDiff() {
    this.showDiff= false
  }

  _swapDiffVersions() {
    const v1 = this.diffVersion1;
    this.diffVersion1 = this.diffVersion2;
    this.diffVersion2 = v1;
  }

  _diffSelectionChanged(t) {
    "v1" == t.target.dataset.side ? this.diffVersion1 = t.target.value : this.diffVersion2 = t.target.value;
  }

  _fileChanged(e) {
    this.fileChanged = e.detail.isChanged;
  }

  _save() {
    if (!this.newComment && !window.confirm('Save file with no comment?')) return;
    let editor = this.shadowRoot.querySelector('ace-editor:not(#editDiffEditor)');
    const url = this.restURL + "version/upload/" + this.path + (this.newComment ? '?comment=' + encodeURIComponent(this.newComment) : '');
    editor.postTo(url).then((data) => {
      this.fileChanged = false;
      editor.readonly = false;
      this.readOnly = true;
      this.fileChanged = false;
      this.showEditDiff = false;
      this.selectedVersion = 'latest';
      this._updateData();
    }).catch(e => this.errorMessage = e.message);
  }
}


export class ConfigExplorer extends LitElement {
  static get styles() {
    return css`
      :host {
        display: block;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 14px;
        color: #222;
      }
      h3 { margin: 0 0 12px; font-size: 16px; font-weight: 600; }
      .path-label { font-size: 13px; color: #555; margin-bottom: 16px; }
      .entry-block {
        border: 1px solid #e0e4ea;
        border-radius: 6px;
        padding: 12px;
        margin-bottom: 12px;
        background: #fafbfc;
      }
      .entry-header {
        display: flex;
        gap: 6px;
        align-items: center;
        flex-wrap: wrap;
      }
      .entry-header label { font-size: 13px; color: #444; white-space: nowrap; }
      .entry-header input[type=text] {
        flex: 1 1 260px;
        padding: 4px 8px;
        border: 1px solid #ccc;
        border-radius: 4px;
        font-size: 13px;
        font-family: monospace;
      }
      .entry-header input[type=text]:focus { border-color: #1a73e8; outline: none; }
      .error-banner {
        background: #fdd;
        border: 1px solid #c00;
        color: #c00;
        padding: 6px 10px;
        margin: 8px 0 0;
        border-radius: 4px;
        font-size: 13px;
      }
      .error-banner button { margin-left: 8px; }
      .result-label {
        font-size: 13px;
        color: #444;
        margin: 10px 0 6px;
        font-weight: 600;
      }
      button {
        font-family: inherit;
        font-size: 13px;
        padding: 4px 12px;
        border: 1px solid #ccc;
        border-radius: 4px;
        background: #f8f8f8;
        cursor: pointer;
        color: #333;
      }
      button:hover:not(:disabled) { background: #e8e8e8; border-color: #aaa; }
      button:disabled { opacity: 0.45; cursor: default; }
      .btn-primary { background: #1a73e8; color: white; border-color: #1a73e8; }
      .btn-primary:hover:not(:disabled) { background: #1558b0; border-color: #1558b0; }
      .btn-danger { color: #c00; border-color: #e8a0a0; }
      .btn-danger:hover:not(:disabled) { background: #fdd; border-color: #c00; }
      .toolbar { display: flex; gap: 6px; align-items: center; margin-top: 4px; }
      .resize-handle {
        height: 6px;
        margin: 2px 0;
        background: #dde2ea;
        border-radius: 3px;
        cursor: row-resize;
        transition: background 0.15s;
      }
      .resize-handle:hover { background: #1a73e8; }
      .pills {
        display: flex;
        flex-wrap: wrap;
        gap: 4px;
        margin-top: 8px;
      }
      .pill {
        padding: 2px 10px;
        background: #e8f0fe;
        border: 1px solid #aac4f5;
        border-radius: 12px;
        font-size: 12px;
        font-family: monospace;
        color: #1a73e8;
        cursor: default;
        user-select: none;
      }
      .pill:hover { background: #d2e3fc; border-color: #1a73e8; }
      .pill-modified { background: #fff3e0; border-color: #ffb74d; color: #e65100; }
      .pill-modified:hover { background: #ffe0b2; border-color: #e65100; }
      .pill-popup {
        position: fixed;
        z-index: 2000;
        background: white;
        border: 1px solid #d0d4da;
        border-radius: 6px;
        box-shadow: 0 4px 18px rgba(0,0,0,0.18);
        padding: 10px 12px;
        max-width: 480px;
        max-height: 320px;
        overflow: auto;
        pointer-events: none;
      }
      .pill-popup-title {
        font-size: 12px;
        font-weight: 600;
        color: #1a73e8;
        margin-bottom: 8px;
      }
      .pill-popup pre {
        margin: 0;
        font-family: monospace;
        font-size: 12px;
        white-space: pre;
        color: #222;
      }
      .pill-popup-info { font-size: 12px; color: #777; }
      .analysis-section {
        border: 1px solid #c8e6c9;
        border-radius: 6px;
        padding: 14px;
        margin-top: 12px;
        background: #f1f8f1;
      }
      .analysis-section h4 {
        margin: 0 0 10px;
        font-size: 14px;
        font-weight: 600;
        color: #2e7d32;
      }
      .analysis-group { margin-bottom: 12px; }
      .analysis-group:last-child { margin-bottom: 0; }
      .analysis-target {
        font-size: 13px;
        font-weight: 600;
        color: #1a73e8;
        margin-bottom: 4px;
      }
      .analysis-item {
        font-size: 12px;
        padding: 3px 0 3px 12px;
        border-left: 2px solid #a5d6a7;
      }
      .analysis-item code {
        font-family: monospace;
        background: #e8f5e9;
        padding: 1px 4px;
        border-radius: 3px;
      }
      .analysis-item .from-list { color: #666; margin-left: 6px; }
      .pill-popup .diff-add { color: #2e7d32; }
      .pill-popup .diff-remove { color: #c62828; }
      .save-dialog-overlay {
        position: fixed;
        inset: 0;
        background: rgba(0,0,0,0.45);
        z-index: 3000;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .save-dialog {
        background: white;
        padding: 20px 24px;
        min-width: 420px;
        border-radius: 8px;
        box-shadow: 0 8px 32px rgba(0,0,0,0.25);
      }
      .save-dialog h4 { margin: 0 0 12px; font-size: 15px; font-weight: 600; }
      .save-dialog label { font-size: 13px; color: #444; }
      .save-dialog input[type=text] {
        display: block;
        width: 100%;
        margin-top: 6px;
        padding: 6px 10px;
        border: 1px solid #ccc;
        border-radius: 4px;
        font-size: 13px;
        box-sizing: border-box;
      }
      .save-dialog input[type=text]:focus { border-color: #1a73e8; outline: none; }
      .save-dialog-buttons { margin-top: 14px; display: flex; gap: 6px; }
      .recent-section { position: relative; display: inline-block; }
      .recent-menu {
        position: absolute;
        bottom: 100%;
        left: 0;
        background: white;
        border: 1px solid #d0d4da;
        border-radius: 6px;
        box-shadow: 0 4px 16px rgba(0,0,0,0.15);
        min-width: 320px;
        max-height: 260px;
        overflow-y: auto;
        z-index: 1000;
        margin-bottom: 4px;
      }
      .recent-item {
        padding: 8px 12px;
        cursor: pointer;
        border-bottom: 1px solid #eee;
        font-size: 12px;
        font-family: monospace;
      }
      .recent-item:last-child { border-bottom: none; }
      .recent-item:hover { background: #f0f5ff; }
      .recent-item-summary { color: #333; }
      .recent-item-count { color: #888; font-family: sans-serif; font-size: 11px; margin-left: 6px; }
    `;
  }

  static get properties() {
    return {
      path: { type: String, notify: true },
      restURL: { type: String, notify: true },
      entries: { type: Array, notify: true },
      _popupData: { type: Object },
      analysisResults: { type: Array },
      analysisLoading: { type: Boolean },
      _modifiedFiles: { type: Object },
      _showRecentMenu: { type: Boolean },
      _showSaveDialog: { type: Boolean },
      _saveComment: { type: String },
    };
  }

  constructor() {
    super();
    this.path = '.';
    this.restURL = '';
    this._nextId = 0;
    this.entries = [this._newEntry()];
    this._popupData = null;
    this._popupTimeout = null;
    this.analysisResults = null;
    this.analysisLoading = false;
    this._modifiedFiles = null;
    this._rawFileTexts = null;
    this._showRecentMenu = false;
    this._showSaveDialog = false;
    this._saveComment = 'Simplified properties via Configuration Explorer';
  }

  _newEntry() {
    return { id: this._nextId++, configString: '', mergedContent: null, loading: false, errorMessage: '', collapsed: false, editorHeight: 400 };
  }

  _updateEntry(id, changes) {
    this.entries = this.entries.map(e => e.id === id ? { ...e, ...changes } : e);
  }

  render() {
    return html`
      <h3>Configuration Explorer</h3>
      <div class="path-label">Path: ${this.path}</div>
      ${repeat(this.entries, e => e.id, (e, i) => this._renderEntry(e, i))}
      <div class="toolbar">
        <button @click=${this._addEntry}>Add Configuration</button>
        <button @click=${this._analyze}
          ?disabled=${this.analysisLoading || this.entries.filter(e => this._parsedParts(e.configString).length).length < 2}>
          ${this.analysisLoading ? 'Analyzing...' : 'Analyze'}
        </button>
        <span class="recent-section">
          <button @click=${() => this._showRecentMenu = !this._showRecentMenu}
            ?disabled=${!this._getRecentSessions().length}>Recent</button>
          ${this._showRecentMenu ? html`
            <div class="recent-menu">
              ${this._getRecentSessions().map((session, i) => html`
                <div class="recent-item" @click=${() => this._restoreSession(session)}>
                  <span class="recent-item-summary">${session.configStrings[0]}</span>
                  ${session.configStrings.length > 1 ? html`<span class="recent-item-count">+ ${session.configStrings.length - 1} more</span>` : null}
                </div>
              `)}
            </div>
          ` : null}
        </span>
        <button @click=${this._back}>Back</button>
      </div>
      ${this.analysisResults ? this._renderAnalysis() : null}
      ${this._popupData ? html`
        <div class="pill-popup" style="left:${this._popupData.x}px;top:${this._popupData.y}px">
          <div class="pill-popup-title">${this._popupData.name}.properties ${this._vLabel(this._popupData.version)}${this._popupData.isDiff ? ' (modified)' : ''}</div>
          ${this._popupData.loading
            ? html`<div class="pill-popup-info">Loading...</div>`
            : this._popupData.error
              ? html`<div class="pill-popup-info" style="color:#c00">${this._popupData.error}</div>`
              : this._popupData.isDiff
                ? html`<pre>${this._popupData.diffLines.map(l =>
                    l.startsWith('+') ? html`<span class="diff-add">${l}\n</span>`
                    : l.startsWith('-') ? html`<span class="diff-remove">${l}\n</span>`
                    : html`${l}\n`
                  )}</pre>`
                : html`<pre>${this._popupData.content}</pre>`}
        </div>
      ` : null}
      ${this._showSaveDialog ? html`
        <div class="save-dialog-overlay">
          <div class="save-dialog">
            <h4>Save Changes</h4>
            <label>Comment:
              <input type="text" .value=${this._saveComment}
                @input=${e => this._saveComment = e.target.value}
                @keydown=${e => e.key === 'Enter' && this._saveModifiedFiles()}>
            </label>
            <div class="save-dialog-buttons">
              <button class="btn-primary" @click=${this._saveModifiedFiles}>Save</button>
              <button @click=${() => this._showSaveDialog = false}>Cancel</button>
            </div>
          </div>
        </div>
      ` : null}
    `;
  }

  _renderEntry(entry, index) {
    const nextEntry = this.entries[index + 1];
    const hasVisible = entry.mergedContent != null && !entry.collapsed;
    const showMiddleHandle = hasVisible && nextEntry && nextEntry.mergedContent != null && !nextEntry.collapsed;
    const showBottomHandle = hasVisible && !nextEntry;
    return html`
      <div class="entry-block">
        <div class="entry-header">
          <label>Configuration String:</label>
          <input type="text" .value=${entry.configString}
            @input=${e => this._updateEntry(entry.id, { configString: e.target.value })}
            @keydown=${e => e.key === 'Enter' && this._loadEntry(entry.id)}
            placeholder="e.g. ats(3)|ats-base(d)|other(l)">
          <button class="btn-primary" @click=${() => this._loadEntry(entry.id)}
            ?disabled=${entry.loading || !entry.configString}>
            ${entry.loading ? 'Loading...' : 'Load'}
          </button>
          ${entry.mergedContent != null ? html`
            <button @click=${() => this._updateEntry(entry.id, { collapsed: !entry.collapsed })}>
              ${entry.collapsed ? '▶ Show' : '▼ Hide'}
            </button>
          ` : null}
          ${this.entries.length > 1 ? html`
            <button class="btn-danger" @click=${() => this._removeEntry(entry.id)}>Remove</button>
          ` : null}
        </div>
        ${this._parsedParts(entry.configString).length ? html`
          <div class="pills">
            ${this._parsedParts(entry.configString).map(({ name, version }) => html`
              <span class="pill ${this._modifiedFiles && this._modifiedFiles[name] ? 'pill-modified' : ''}"
                @mouseenter=${e => this._showPillPopup(e, entry.id, name, version)}
                @mouseleave=${() => this._hidePillPopup()}>
                ${name}${version !== 'default' ? `(${version})` : ''}
              </span>
            `)}
          </div>
        ` : null}
        ${entry.errorMessage ? html`
          <div class="error-banner">${entry.errorMessage}
            <button @click=${() => this._updateEntry(entry.id, { errorMessage: '' })}>✕</button>
          </div>
        ` : null}
        ${entry.mergedContent != null ? html`
          <div style="display:${entry.collapsed ? 'none' : 'block'}">
            <div class="result-label">Merged Configuration:</div>
            <ace-editor id="editor-${entry.id}" readonly name="merged.properties"
              style="height:${entry.editorHeight}px"></ace-editor>
          </div>
        ` : null}
      </div>
      ${showMiddleHandle ? html`
        <div class="resize-handle"
          @mousedown=${e => this._startResize(e, entry.id, nextEntry.id)}></div>
      ` : showBottomHandle ? html`
        <div class="resize-handle"
          @mousedown=${e => this._startResizeBottom(e, entry.id)}></div>
      ` : null}
    `;
  }

  _vLabel(v) {
    return v === 'default' || v === 'd' ? '(default)' : v === 'l' || v === 'latest' ? '(latest)' : `(v${v})`;
  }

  _resolveVersion(v) {
    if (v === 'd') return 'default';
    if (v === 'l') return 'latest';
    return v;
  }

  _parsedParts(configString) {
    if (!configString) return [];
    try { return this._parseConfigString(configString); }
    catch { return []; }
  }

  _showPillPopup(e, entryId, name, version) {
    clearTimeout(this._popupTimeout);
    const rect = e.target.getBoundingClientRect();
    this._popupTimeout = setTimeout(async () => {
      const key = `${entryId}:${name}:${version}`;
      if (this._modifiedFiles && this._modifiedFiles[name]) {
        const diffLines = this._getFileDiff(name);
        this._popupData = { key, name, version, loading: false, content: null, error: null, isDiff: true, diffLines, x: rect.left, y: rect.bottom + 6 };
        return;
      }
      this._popupData = { key, name, version, loading: true, content: null, error: null, isDiff: false, x: rect.left, y: rect.bottom + 6 };
      try {
        const url = this.restURL + 'version/download/' + this.path + '/' + name + '.properties?version=' + this._resolveVersion(version);
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const text = await response.text();
        if (this._popupData?.key === key) {
          this._popupData = { ...this._popupData, loading: false, content: text };
        }
      } catch (err) {
        if (this._popupData?.key === key) {
          this._popupData = { ...this._popupData, loading: false, error: err.message };
        }
      }
    }, 200);
  }

  _hidePillPopup() {
    clearTimeout(this._popupTimeout);
    this._popupData = null;
  }

  _startResizeBottom(e, id) {
    e.preventDefault();
    const startY = e.clientY;
    const el = this.shadowRoot.querySelector(`#editor-${id}`);
    if (!el) return;
    const startH = el.offsetHeight;
    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';
    const onMove = ev => {
      const newH = Math.max(80, startH + (ev.clientY - startY));
      el.style.height = newH + 'px';
      if (el.editor) el.editor.resize();
    };
    const onUp = ev => {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      this._updateEntry(id, { editorHeight: Math.max(80, startH + (ev.clientY - startY)) });
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }

  _startResize(e, topId, botId) {
    e.preventDefault();
    const startY = e.clientY;
    const topEl = this.shadowRoot.querySelector(`#editor-${topId}`);
    const botEl = this.shadowRoot.querySelector(`#editor-${botId}`);
    if (!topEl || !botEl) return;
    const topStartH = topEl.offsetHeight;
    const botStartH = botEl.offsetHeight;
    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';
    const onMove = ev => {
      const delta = ev.clientY - startY;
      const newTopH = Math.max(80, topStartH + delta);
      const newBotH = Math.max(80, botStartH - delta);
      topEl.style.height = newTopH + 'px';
      botEl.style.height = newBotH + 'px';
      if (topEl.editor) topEl.editor.resize();
      if (botEl.editor) botEl.editor.resize();
    };
    const onUp = ev => {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      const delta = ev.clientY - startY;
      this._updateEntry(topId, { editorHeight: Math.max(80, topStartH + delta) });
      this._updateEntry(botId, { editorHeight: Math.max(80, botStartH - delta) });
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }

  _addEntry() {
    this.entries = [...this.entries, this._newEntry()];
  }

  _removeEntry(id) {
    this.entries = this.entries.filter(e => e.id !== id);
  }

  _parseConfigString(str) {
    return str.split('|').map(part => {
      const m = part.trim().match(/^([^(]+?)(?:\((\d+|[dl])\))?$/);
      if (!m) throw new Error(`Invalid config entry: "${part.trim()}"`);
      return { name: m[1].trim(), version: m[2] || 'default' };
    });
  }

  _parseProperties(text) {
    const result = {};
    for (const rawLine of text.split('\n')) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#') || line.startsWith('!')) continue;
      const eqIdx = line.indexOf('=');
      const colonIdx = line.indexOf(':');
      let sep = -1;
      if (eqIdx >= 0 && colonIdx >= 0) sep = Math.min(eqIdx, colonIdx);
      else if (eqIdx >= 0) sep = eqIdx;
      else if (colonIdx >= 0) sep = colonIdx;
      if (sep < 0) continue;
      const key = line.slice(0, sep).trimEnd();
      const value = line.slice(sep + 1).trimStart();
      if (key) result[key] = value;
    }
    return result;
  }

  _formatProperties(merged, sources, overrides) {
    const vLabel = v => v === 'unsaved' ? '(unsaved)' : v === 'default' || v === 'd' ? '(default)' : v === 'l' ? '(latest)' : `(v${v})`;
    const pairs = Object.entries(merged).sort(([a], [b]) => a.localeCompare(b));
    const kvStrings = pairs.map(([k, v]) => `${k}=${v}`);
    const maxLen = kvStrings.reduce((m, s) => Math.max(m, s.length), 0);
    return pairs.map(([k], i) => {
      const src = sources[k];
      let comment = `# ${src.file} ${vLabel(src.version)}`;
      const prev = overrides[k];
      if (prev && prev.length > 0) {
        comment += `, overrides ${prev.map(s => `${s.file} ${vLabel(s.version)}`).join(', ')}`;
      }
      return kvStrings[i].padEnd(maxLen) + '   ' + comment;
    }).join('\n');
  }

  async _loadEntry(id) {
    const entry = this.entries.find(e => e.id === id);
    if (!entry || !entry.configString || entry.loading) return;
    this._updateEntry(id, { errorMessage: '', loading: true, mergedContent: null, collapsed: false });
    const merged = {};
    const sources = {};
    const overrides = {};
    let content = null;
    try {
      const entries = this._parseConfigString(entry.configString);
      for (const { name, version } of entries) {
        const text = await this._getFileText(name, version);
        const effectiveVersion = (this._modifiedFiles && this._modifiedFiles[name]) ? 'unsaved' : version;
        for (const [key, value] of Object.entries(this._parseProperties(text))) {
          if (key in merged) {
            if (!overrides[key]) overrides[key] = [];
            overrides[key].push(sources[key]);
          }
          merged[key] = value;
          sources[key] = { file: name + '.properties', version: effectiveVersion };
        }
      }
      content = this._formatProperties(merged, sources, overrides);
    } catch (e) {
      this._updateEntry(id, { errorMessage: e.message, loading: false });
      return;
    }
    this._updateEntry(id, { mergedContent: content, loading: false });
    this._saveSession();
    await this.updateComplete;
    const editor = this.shadowRoot.querySelector(`#editor-${id}`);
    if (editor) {
      await editor.updateComplete;
      if (editor.editor) {
        editor.editor.setValue(content, -1);
        editor.editor.session.getUndoManager().reset();
      }
    }
  }

  _renderAnalysis() {
    const grouped = {};
    for (const s of this.analysisResults) {
      if (!grouped[s.promoteTo]) grouped[s.promoteTo] = [];
      grouped[s.promoteTo].push(s);
    }
    return html`
      <div class="analysis-section">
        <h4>Promotion Opportunities
          ${this.analysisResults.length > 0 && !this._modifiedFiles ? html`
            <button style="margin-left:10px;font-size:12px" class="btn-primary" @click=${this._applyAnalysis}>Apply (in memory)</button>
          ` : null}
          ${this._modifiedFiles && Object.keys(this._modifiedFiles).length ? html`
            <button style="margin-left:10px;font-size:12px" class="btn-primary" @click=${this._openSaveDialog}>Save Changes</button>
          ` : null}
          <button style="margin-left:10px;font-size:12px" @click=${this._closeAnalysis}>Close</button>
        </h4>
        ${this.analysisResults.length === 0
          ? html`<div style="font-size:13px;color:#555">No promotion opportunities found.</div>`
          : Object.entries(grouped).map(([target, items]) => html`
            <div class="analysis-group">
              <div class="analysis-target">Promote to ${target}.properties:</div>
              ${items.map(item => html`
                <div class="analysis-item">
                  <code>${item.property}=${item.value}</code>
                  <span class="from-list">(currently in ${item.from.map(f => f + '.properties').join(', ')})</span>
                </div>
              `)}
            </div>
          `)}
      </div>
    `;
  }

  async _analyze() {
    this.analysisLoading = true;
    this.analysisResults = null;
    this._modifiedFiles = null;
    try {
      const chains = this.entries
        .map(e => this._parsedParts(e.configString))
        .filter(parts => parts.length > 0);
      if (chains.length < 2) return;
      const tree = this._buildTree(chains);
      const uniqueFiles = new Map();
      for (const chain of chains) {
        for (const { name, version } of chain) {
          if (!uniqueFiles.has(name)) uniqueFiles.set(name, version);
        }
      }
      this._rawFileTexts = {};
      const rawPropsMap = {};
      await Promise.all([...uniqueFiles.entries()].map(async ([name, version]) => {
        const url = this.restURL + 'version/download/' + this.path + '/' + name + '.properties?version=' + this._resolveVersion(version);
        try {
          const response = await fetch(url);
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          const text = await response.text();
          this._rawFileTexts[name] = text;
          rawPropsMap[name] = this._parseProperties(text);
        } catch {
          this._rawFileTexts[name] = '';
          rawPropsMap[name] = {};
        }
      }));
      const { suggestions } = this._analyzeNode(tree, rawPropsMap);
      this.analysisResults = suggestions;
    } catch (e) {
      this.analysisResults = [];
    } finally {
      this.analysisLoading = false;
    }
  }

  _buildTree(chains) {
    const root = { name: null, version: null, children: {} };
    for (const chain of chains) {
      let node = root;
      for (const { name, version } of chain) {
        if (!node.children[name]) {
          node.children[name] = { name, version, children: {} };
        }
        node = node.children[name];
      }
    }
    return root;
  }

  _analyzeNode(node, rawPropsMap) {
    const childNames = Object.keys(node.children);
    if (childNames.length === 0) {
      const raw = rawPropsMap[node.name] || {};
      const effective = {};
      for (const [key, value] of Object.entries(raw)) {
        effective[key] = { value, sources: [node.name] };
      }
      return { effective, suggestions: [] };
    }
    const childEffectives = {};
    const allSuggestions = [];
    for (const childName of childNames) {
      const result = this._analyzeNode(node.children[childName], rawPropsMap);
      childEffectives[childName] = result.effective;
      allSuggestions.push(...result.suggestions);
    }
    const allKeys = new Set();
    for (const eff of Object.values(childEffectives)) {
      for (const key of Object.keys(eff)) allKeys.add(key);
    }
    const promotable = {};
    for (const key of allKeys) {
      const entries = [];
      for (const cn of childNames) {
        if (childEffectives[cn][key]) entries.push(childEffectives[cn][key]);
      }
      if (entries.length === childNames.length && entries.every(e => e.value === entries[0].value)) {
        promotable[key] = { value: entries[0].value, sources: entries.flatMap(e => e.sources) };
      }
    }
    const nodeRaw = node.name ? (rawPropsMap[node.name] || {}) : {};
    for (const [key, { value, sources }] of Object.entries(promotable)) {
      if (nodeRaw[key] !== value && node.name) {
        allSuggestions.push({
          property: key,
          value,
          promoteTo: node.name,
          from: childNames
        });
      }
    }
    const effective = {};
    for (const [key, data] of Object.entries(promotable)) {
      effective[key] = data;
    }
    if (node.name) {
      for (const [key, value] of Object.entries(nodeRaw)) {
        effective[key] = { value, sources: [node.name] };
      }
    }
    return { effective, suggestions: allSuggestions };
  }

  _getStorageKey() {
    return `config-explorer:${this.path}`;
  }

  _getRecentSessions() {
    try {
      return JSON.parse(localStorage.getItem(this._getStorageKey()) || '[]');
    } catch { return []; }
  }

  _saveSession() {
    const validEntries = this.entries.filter(e => e.configString.trim());
    if (!validEntries.length) return;
    const configStrings = validEntries.map(e => e.configString);
    const editorHeights = validEntries.map(e => e.editorHeight);
    const sessions = this._getRecentSessions();
    const key = configStrings.join('\n');
    const filtered = sessions.filter(s => s.configStrings.join('\n') !== key);
    filtered.unshift({ configStrings, editorHeights });
    const trimmed = filtered.slice(0, 10);
    try { localStorage.setItem(this._getStorageKey(), JSON.stringify(trimmed)); } catch {}
  }

  _restoreSession(session) {
    this._showRecentMenu = false;
    this._nextId = 0;
    this.entries = session.configStrings.map((cs, i) => ({
      ...this._newEntry(),
      configString: cs,
      editorHeight: session.editorHeights ? session.editorHeights[i] : 400
    }));
    this._loadAllEntries();
  }

  async _loadAllEntries() {
    for (const entry of this.entries) {
      if (entry.configString) {
        await this._loadEntry(entry.id);
      }
    }
  }

  _closeAnalysis() {
    this.analysisResults = null;
    this._modifiedFiles = null;
    this._rawFileTexts = null;
    this._reloadAllEntries();
  }

  _propsToText(propsMap) {
    return Object.entries(propsMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join('\n');
  }

  _getFileDiff(name) {
    const mod = this._modifiedFiles[name];
    if (!mod) return [];
    const origProps = this._parseProperties(mod.originalText);
    const modProps = this._parseProperties(mod.modifiedText);
    const allKeys = [...new Set([...Object.keys(origProps), ...Object.keys(modProps)])].sort();
    const lines = [];
    for (const key of allKeys) {
      const ov = origProps[key], mv = modProps[key];
      if (ov && !mv) lines.push(`- ${key}=${ov}`);
      else if (!ov && mv) lines.push(`+ ${key}=${mv}`);
      else if (ov !== mv) { lines.push(`- ${key}=${ov}`); lines.push(`+ ${key}=${mv}`); }
    }
    return lines;
  }

  async _getFileText(name, version) {
    if (this._modifiedFiles && this._modifiedFiles[name]) {
      return this._modifiedFiles[name].modifiedText;
    }
    const url = this.restURL + 'version/download/' + this.path + '/' + name + '.properties?version=' + this._resolveVersion(version);
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to load ${name}.properties (${response.status})`);
    return response.text();
  }

  _applyAnalysis() {
    const workingProps = {};
    for (const [name, text] of Object.entries(this._rawFileTexts)) {
      workingProps[name] = { ...this._parseProperties(text) };
    }
    for (const { property, value, promoteTo, from } of this.analysisResults) {
      if (!workingProps[promoteTo]) workingProps[promoteTo] = {};
      workingProps[promoteTo][property] = value;
      for (const source of from) {
        if (workingProps[source]) delete workingProps[source][property];
      }
    }
    this._modifiedFiles = {};
    for (const [name, text] of Object.entries(this._rawFileTexts)) {
      const originalProps = this._parseProperties(text);
      const origNorm = this._propsToText(originalProps);
      const modNorm = this._propsToText(workingProps[name]);
      if (origNorm !== modNorm) {
        this._modifiedFiles[name] = { originalText: text, modifiedText: modNorm };
      }
    }
    this._reloadAllEntries();
  }

  _openSaveDialog() {
    this._saveComment = 'Simplified properties via Configuration Explorer';
    this._showSaveDialog = true;
  }

  async _saveModifiedFiles() {
    this._showSaveDialog = false;
    const names = Object.keys(this._modifiedFiles);
    const errors = [];
    for (const name of names) {
      const content = this._modifiedFiles[name].modifiedText;
      const url = this.restURL + 'version/upload/' + this.path + '/' + name + '.properties?comment=' + encodeURIComponent(this._saveComment);
      const headers = { 'Content-type': 'application/octet-stream' };
      if (jwt) headers['Authorization'] = 'Bearer ' + jwt;
      try {
        const response = await fetch(url, { method: 'POST', body: content, headers });
        if (!response.ok) errors.push(`${name}.properties: HTTP ${response.status}`);
      } catch (e) {
        errors.push(`${name}.properties: ${e.message}`);
      }
    }
    if (errors.length) {
      alert('Some files failed to save:\n' + errors.join('\n'));
    }
    this._modifiedFiles = null;
    this._rawFileTexts = null;
    this.analysisResults = null;
    this._reloadAllEntries();
  }

  async _reloadAllEntries() {
    for (const entry of this.entries) {
      if (entry.configString && entry.mergedContent != null) {
        await this._loadEntry(entry.id);
      }
    }
  }

  _back() {
    this.dispatchEvent(new CustomEvent('back'));
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
window.customElements.define('config-explorer', ConfigExplorer);
