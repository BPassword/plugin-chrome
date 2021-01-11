import { nanoid } from 'nanoid';

import logger from '@lib/logger';
import { LOG_LEVEL } from '@lib/code-settings';
import { shouldActivedJet } from '../injet-helper';
import FieldController from '../libs/field-controller';

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

  const initState = {
    extid: browser.runtime.id,
    baseUrl: browser.runtime.getURL(''),
  };
  const controller = new FieldController(initState);
  global.fctx = controller;
  logger.debug('SubInjet :>>>>>>', window.location.href);
  controller.checkLoginForm();

  window.addEventListener('bpass:buuton:toggler', function (evt) {
    const reqData = evt.detail;
    // logger.debug('Recieved Message:>>>>>>>>>>>>>>>>>>>>>>>',reqData);
    controller.bpassButtonEventHandler(reqData);
  });

  // await injetSub();
}

async function injetSub() {
  return new Promise((resolve, reject) => {
    const initState = {
      extid: browser.runtime.id,
      baseUrl: browser.runtime.getURL(''),
    };
    const controller = new FieldController(initState);
    global.fctx = controller;
    logger.debug('SubInjet :', window.location.href);
    constroller.checkLoginForm();

    return resolve(controller);
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
