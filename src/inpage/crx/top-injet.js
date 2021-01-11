import logger from '@lib/logger';
import { shouldActivedJet } from '../injet-helper';
import { LOG_LEVEL } from '@lib/code-settings';

import browser from 'webextension-polyfill';

import TopController from '../libs/top-controller';
import { CNST_PATH } from '../injet-helper';

import {
  API_FETCH_EXT_STATE,
  API_WIN_FINDED_LOGIN,
  API_WIN_SELECTOR_UP_VALT,
  API_WIN_SELECTOR_DRAWER,
  API_WIN_SELECTOR_ERASER,
  API_WIN_SELECTOR_ERASER_FORCE,
  API_WIN_SELECTOR_TOGGLE,
  API_WIN_SELECTOR_UP_HEIGHT,
  API_WIN_SELECTOR_UP_DRAWER,
} from '@lib/msgapi/api-types';
/*********************************************************************
 * AircraftClass ::
 *    @description:
 *    @description:
 * WARNINGS:
 *
 * HISTORY:
 *    @author: lanbery@gmail.com
 *    @created:  2020-12-05
 *    @comments: For Chrome
 **********************************************************************/

if (shouldActivedJet()) {
  if (window.top === window.self) {
    const initConfig = {
      extid: browser.runtime.id,
      baseUrl: browser.runtime.getURL(''),
      leechSrc: browser.runtime.getURL(CNST_PATH.leechPath),
      leechAddorSrc: browser.runtime.getURL(CNST_PATH.leechAddorPath),
    };

    logger.debug('startup top injet initState>>>>', initConfig);
    const controller = new TopController({ initConfig });
    LOG_LEVEL === 'DEBUG' && (global.tctx = controller);

    startupTopJetMessageListener(controller);
  } else {
    logger.warn('no inject sub.');
  }
}

function startupTopJetMessageListener(ctx) {
  window.addEventListener('message', (evt) => {
    const recMessage = evt.data;
    if (!recMessage || !recMessage.apiType) {
      return;
    }
    const { apiType, data, from = 'Unknow origin' } = recMessage;
    logger.debug('TJet==> received Message>>>>', apiType, data, from, evt);

    switch (apiType) {
      case API_WIN_FINDED_LOGIN:
        ctx.updatefindedMessageHandler(data, evt);
        break;
      case API_WIN_SELECTOR_DRAWER:
        ctx.drawingSelector(data);
        break;
      case API_WIN_SELECTOR_ERASER:
        ctx.eraseSelectorBox();
        break;
      case API_WIN_SELECTOR_ERASER_FORCE:
        ctx.eraseSelectorBox(true);
        break;
      case API_WIN_SELECTOR_TOGGLE:
        ctx.toggleSelectorBox(data);
        break;
      case API_WIN_SELECTOR_UP_DRAWER:
        ctx.drawOrUpdateSelectorBoxIframeHeight(data);
        break;
      case API_WIN_SELECTOR_UP_HEIGHT:
        ctx.updateSelectorBoxIfrHeight(data);
        break;
      default:
        break;
    }
  });
}

async function domIsReady() {
  if (['interactive', 'complete'].includes(document.readyState)) {
    return true;
  }

  return new Promise((resolve) =>
    window.addEventListener('DOMContentLoaded', resolve, { once: true })
  );
}
