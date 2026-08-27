'use strict';

const { contextBridge, ipcRenderer } = require('electron');

// The only surface the renderer gets. No node, no fs, no ipcRenderer itself.
contextBridge.exposeInMainWorld('habitAPI', {
  load: () => ipcRenderer.invoke('store:load'),
  save: (payload) => ipcRenderer.invoke('store:save', payload),
  setPinned: (pinned) => ipcRenderer.invoke('win:setPinned', pinned),
  resizeBy: (dx, dy) => ipcRenderer.invoke('win:resizeBy', dx, dy),
  getLoginItem: () => ipcRenderer.invoke('app:getLoginItem'),
  setLoginItem: (enabled) => ipcRenderer.invoke('app:setLoginItem', enabled),
  hide: () => ipcRenderer.invoke('win:hide'),
  quit: () => ipcRenderer.invoke('app:quit')
});
