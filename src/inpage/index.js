import logger from '@lib/logger';

import { shouldActivedJet, CNST_PATH } from './injet-helper';
import { buildExtAppName, LOG_LEVEL } from '@lib/code-settings.js';
import { BPASS_BUTTON_TAG, BpassButton } from '@/inpage/libs/bpass-button';
import { bpassButtonBuillder } from './sharp-elevent';

const browser = require('webextension-polyfill');
/*********************************************************************
 * AircraftClass ::
 *    @description:
 *    @description:
 * WARNINGS:
 *
 * HISTORY:
 *    @author: lanbery@gmail.com
 *    @created:  2020-12-04
 *    @comments:
 **********************************************************************/

if (shouldActivedJet()) {
  startup();
}

async function startup() {
  await domIsReady();
  injectStyles();

  // try {
  //   window.customElements.define(BPASS_BUTTON_TAG, BpassButton);
  //   logger.debug(`Registed ${BPASS_BUTTON_TAG} success.`);
  // } catch (err) {
  //   logger.warn(`Registed ${BPASS_BUTTON_TAG} failed.`, err.message);
  // }

  const state = {
    extid: browser.runtime.id,
  };

  injet11(state);
  // deBugInjetSub();
}

function injectStyles() {
  const linkUrl = browser.runtime.getURL(CNST_PATH.jetCss);
  try {
    const container = document.head || document.documentElement;
    let style = document.createElement('link');

    style.rel = 'stylesheet';
    style.type = 'text/css';
    style.href = linkUrl;
    container.appendChild(style);
    logger.debug(`${buildExtAppName} inject css file[${linkUrl}] success.`);
  } catch (err) {
    logger.warn(`${buildExtAppName} inject css file[${linkUrl}] fail.`, err);
  }
}

function injet11(state = {}) {
  const jetid = '__bpb__11__';
  const jetContent = bpassButtonBuillder(jetid, state);
  try {
    const container = document.head || document.documentElement;
    let scriptEl = document.createElement('script');

    scriptEl.setAttribute('charset', 'UTF-8');
    scriptEl.textContent = jetContent;
    container.appendChild(scriptEl);
    logger.debug(`${buildExtAppName} inject css file[${jetid}] success.`);
  } catch (err) {
    logger.warn(`${buildExtAppName} inject css file[${jetid}] fail.`, err.message);
  }
}

function deBugInjetSub() {
  if (LOG_LEVEL !== 'DEBUG') return;

  const jetSrc = browser.runtime.getURL(CNST_PATH.subJet);
  try {
    const container = document.head || document.documentElement;
    let scriptEl = document.createElement('script');
    scriptEl.setAttribute('async', 'false');
    scriptEl.setAttribute('charset', 'UTF-8');
    scriptEl.setAttribute('ll', LOG_LEVEL);
    scriptEl.src = jetSrc;
    container.appendChild(scriptEl);
    logger.debug(`${buildExtAppName} inject css file[${jetSrc}] success.`);
  } catch (err) {
    logger.warn(`${buildExtAppName} inject css file[${jetSrc}] fail.`, err.message);
  }
}

async function domIsReady() {
  if (['interactive', 'complete'].includes(document.readyState)) {
    return true;
  }

  return new Promise((resolve) =>
    window.addEventListener('DOMContentLoaded', resolve, { once: true })
  );
}
