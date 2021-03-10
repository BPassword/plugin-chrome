import { debounce } from 'lodash';
import ObservableStore from 'obs-store';

import logger from '@lib/logger';
import BaseController from './base-controller';
import { BPASS_BUTTON_TAG, BpassButton } from './bpass-button';
import Zombie from '@lib/messages/corpse-chaser';

import { ifrSizeCalcWhenValtChanged } from '@lib/controllers/size-calculator.js';
import { ENV_TYPE_INJET } from '@lib/enums';
import {
  API_WIN_FINDED_LOGIN,
  API_WIN_SELECTOR_DRAWER,
  API_WIN_SELECTOR_ERASER,
  API_WIN_SELECTOR_ERASER_FORCE,
  API_WIN_SELECTOR_TOGGLE,
  API_WIN_SELECTOR_UP_VALT,
  API_RT_FIELDS_VALT_CHANGED,
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
 *    @created:  2020-12-04
 *    @comments:
 **********************************************************************/
export const PASSWORD_SELECTOR = 'input[type="password"][name],input[type="password"]';
export const USERNAME_SELECTOR =
  'input[type="mail"][name],input[type="text"][name],input[type="text"][id],input[type="text"]';
class FieldController extends BaseController {
  constructor(initState = {}) {
    super({ type: '__bpfield_' });
    this.extid = initState.extid || '';
    this.enabledFocusoutErase = true;

    this.eventDefaults = {
      bubbles: true,
      cancelable: true,
    };

    this.backendStore = new ObservableStore({ isUnlocked: false, items: [], matchedNum: 0 });

    /** ------- event -------- */

    this.mutationObserver = new MutationObserver(
      debounce(this._mutationObserverListener.bind(this), 15)
    );

    if (window.document.body && window.document.body.childElementCount > 0) {
      this.mutationObserver.observe(document.body, {
        childList: true, //
        subtree: true, //
        attributes: true, //
      });
    }

    /** <---------- emmit define ---------> */
    this.on('enabled:input:valtChanged', this.enabledInputFieldValtChangedListener.bind(this));
    this.on('disabled:input:valtChanged', this.disabledInputFieldValtChangedListener.bind(this));

    this.once('actived:zombie-communication', this._activedZombieCommunication.bind(this));
    this.once('enabled:resize:obs', this.enabledPositionResizeObserve.bind(this));

    /** scroll  */
    this.once('enabled:private:msg-listener', this.enabledSelfPrivateMsgListener.bind(this));
    this.once('actived:login:window:scroll-obs', this.activedLoginWindowScrollObs.bind(this));

    this.on('enabled:target:observer', this._startupTargetObserverListener.bind(this));
  }

  /** +++++++++++++++++++++++++++ EventHandler ++++++++++++++++++++++++++++++++++++++ */

  _startupTargetObserverListener(target) {
    const defaultOpts = {
      childList: false, //
      subtree: false, //
      attributes: true,
    };

    this.targetObserver = new MutationObserver(
      debounce(this._targetObserverHandler.bind(this), 200)
    );
    if (target) {
    }
  }

  _targetObserverHandler(records) {}

  enabledInputFieldValtChangedListener(el) {
    logger.debug('FieldController:enabledInputFieldValtChangedListener#on:>>>>>>', el);
    el &&
      el.addEventListener(
        'input',
        debounce(this.inputFieldValtChangedHandler.bind(this, el), 800),
        true
      );
  }

  disabledInputFieldValtChangedListener(el) {
    el && el.removeEventListener('input', this.inputFieldValtChangedHandler.bind(this), true);
  }

  /**
   *
   * @param {element} target
   */
  inputFieldValtChangedHandler(target) {
    const valtState = this.getValtState(target);

    this._sendMessageToTop(API_WIN_SELECTOR_UP_VALT, valtState);
    // send to backend
    if (this.zombie) {
      this.zombie.postMessage(API_RT_FIELDS_VALT_CHANGED, valtState);
    }

    /** API_WIN_SELECTOR_UP_DRAWER */
    const activedDomRect = target.getBoundingClientRect();
    const serializeDomRect = JSON.parse(JSON.stringify(activedDomRect));

    //

    const paramState = this.comboSizeCalcParams(target);
    const ifrSizeState = ifrSizeCalcWhenValtChanged(paramState, true);

    const { elemType, ifrHeight, tag } = ifrSizeState;
    const drawMessageData = this.comboSelectorBoxSendData(ifrHeight, serializeDomRect);
    logger.debug('inputFieldValtChangedHandler>>>', elemType, tag, drawMessageData, paramState);
    if (elemType === 'drawing') {
      const backendState = this.backendStore.getState();
      const { isUnlocked } = backendState;
      if (!isUnlocked && valtState.activedField === 'password') {
        this._sendMessageToTop(API_WIN_SELECTOR_ERASER, {
          from: 'input:fields:changed:password:locked',
        });
      } else {
        this._sendMessageToTop(API_WIN_SELECTOR_UP_DRAWER, drawMessageData);
      }
    } else if (elemType === 'erase') {
      this._sendMessageToTop(API_WIN_SELECTOR_ERASER, { from: 'input:fields:changed' });
    }
  }

  _mutationObserverListener(records) {
    if (!this.targetPassword || !this.targetUsername) {
      const { targetPassword, targetUsername } = lookupLoginFeildsInDom();
      this.targetPassword = targetPassword;
      this.targetUsername = targetUsername;

      if (targetPassword && targetUsername) {
        logger.debug('records>>>>>>>>>>', records);
        const hostname = this.getHost();
        if (window.self !== window.top) {
          this.emit('enabled:private:msg-listener');
        }

        BindingFocusEvents.call(this);

        // send API_WIN_FINDED_LOGIN Message
        const findedData = {
          isInner: window.self !== window.top,
          senderId: this.getId(),
          href: window.location.href,
          hostname: hostname,
        };

        this._sendMessageToTop(API_WIN_FINDED_LOGIN, findedData);

        // position changed listener
        this.emit('enabled:resize:obs');
        this.emit('actived:login:window:scroll-obs');
        // emit active Long connect background
        this.emit('actived:zombie-communication');
      }
    }

    if (
      (this.targetPassword &&
        this.targetPassword.getBoundingClientRect() &&
        this.targetPassword.getBoundingClientRect().width === 0) ||
      !this.activedTarget
    ) {
      // send selector box display ximalaya
      // fixed when other changed alaways ereaser
      // document.querySelector(BPASS_BUTTON_TAG) && document.querySelector(BPASS_BUTTON_TAG).remove();
      // this.sendEraseSelectorBoxMessage(false, 'attribute mutation listener.');
    }
  }

  _activedZombieCommunication() {
    const hostname = this.getHost();
    const extid = this.extid;
    const opts = {
      hostname,
      portName: ENV_TYPE_INJET,
      includeTlsChannelId: false,
      updateMatchedState: this.updateBackendStore.bind(this),
      filledInputFields: this.filledInputFields.bind(this),
    };

    this.zombie = new Zombie(opts);
    this.zombie.startupZombie({ hostname, extid });
  }

  bpassButtonEventHandler(reqData) {
    const { fctxid, extid, command, data } = reqData;

    if (fctxid !== this.getId() || extid !== this.extid) {
      logger.warn(`Received Event illegal.will ignored. ${fctxid} - ${extid}`);
      return;
    }

    logger.debug('bpassButtonEventHandler>>>>', fctxid, extid, command);

    switch (command) {
      case 'toggler':
        // logger.debug('toggler>>>', data, this.activedTarget);
        this.togglerSendToTop();
        break;
      default:
        break;
    }
  }

  /**
   * 开启热size 监控
   */
  enabledPositionResizeObserve() {
    // logger.debug('activedPositionResizeObserve>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>')
    this.resizeObserver = new ResizeObserver(debounce(this.resizePisitonHandler.bind(this), 100));
    this.resizeObserver.observe(document.body);
  }

  /**
   * Firefox :
   * @param {*} entries
   */
  resizePisitonHandler(entries) {
    const target = this.activedTarget || this.targetUsername || this.targetPassword;
    if (!target) {
      return;
    }
    logger.debug('activedPositionResizeObserve>>>>>>>>>after>>>>>>>>>>>>>>>>>>>>>>>>>>>', target);

    //update icon position
    _updateBpassButtonPoistion.call(this, target);
    this.sendTargetPosition(target);
  }

  /**received top actived posi chain commands */
  enabledSelfPrivateMsgListener() {
    const selfId = this.getId();
    window.addEventListener('message', (evt) => {
      if (!evt.data || (evt.data.token !== selfId && !evt.data.command)) {
        return;
      }
      logger.debug('FieldController::enabledSelfPrivateMsgListener>>>', evt.data);
      const target = this.activedTarget || this.targetUsername || this.targetPassword;
      const { command } = evt.data;
      switch (command) {
        case 'resize':
        case 'scroll':
          target && this.sendTargetPosition(target);
          break;
        default:
          break;
      }
    });
  }

  activedLoginWindowScrollObs() {
    window.addEventListener('scroll', debounce(this.loginWindowScrollHandler.bind(this), 100));
  }

  loginWindowScrollHandler(el) {
    const target = this.activedTarget || this.targetUsername || this.targetPassword;
    if (target) {
      this.sendTargetPosition(target);
      _updateBpassButtonPoistion.call(this, target);
    }
  }

  /** === ************ Selector box Message ********************** === */
  sendEraseSelectorBoxMessage(force = false, from = 'fieldController') {
    const sendMessage = {
      apiType: !force ? API_WIN_SELECTOR_ERASER : API_WIN_SELECTOR_ERASER_FORCE,
      data: { force, from },
    };
    window.top.postMessage(sendMessage, '*');
  }

  /**
   *
   */
  togglerSendToTop() {
    const target = this.activedTarget;
    if (!target) {
      logger.warn('lost target focus.');
      return;
    }
    this.sendTargetPosition(target);
    const paramState = this.comboSizeCalcParams(target);
    const ifrSizeState = ifrSizeCalcWhenValtChanged(paramState);

    const { elemType, ifrHeight, tag } = ifrSizeState;

    const activedDomRect = target.getBoundingClientRect();
    const serializeDomRect = JSON.parse(JSON.stringify(activedDomRect));
    const drawMessageData = this.comboSelectorBoxSendData(ifrHeight, serializeDomRect);
    logger.debug(
      'iconClickHandler::toggler>ifrSizeCalcWhenValtChanged>>>>>>>>>>>>>>>',
      elemType,
      tag,
      JSON.stringify(ifrSizeState),
      drawMessageData
    );
    this._sendMessageToTop(API_WIN_SELECTOR_TOGGLE, drawMessageData);
  }

  /**
   * Send Selector box command
   * @param {string} apiType
   * @param {object} data
   */
  _sendMessageToTop(apiType, data) {
    const sendMessage = {
      apiType,
      data,
    };

    window.top.postMessage(sendMessage, '*');
  }
  /* ================= This instance Methods ==================================== */

  updateBackendStore(state) {
    if (typeof state === 'object') {
      this.backendStore.updateState(state);
    }
  }

  filledInputFields(valtState) {
    if (typeof valtState !== 'object') {
      return;
    }
    const { username = '', password = '' } = valtState;

    this.targetUsername && (this.targetUsername.value = username);
    this.targetPassword && (this.targetPassword.value = password);
  }

  /**
   *
   * @param {element} target
   */
  comboSizeCalcParams(target) {
    const valtState = this.getValtState(target);
    const backendState = this.backendStore.getState();

    return { ...valtState, ...backendState };
  }

  comboSelectorBoxSendData(ifrHeight, serializeDomRect) {
    serializeDomRect = serializeDomRect || {
      width: 0,
      height: 0,
      left: 0,
      top: 0,
      right: 0,
      bottom: 0,
      x: 0,
      y: 0,
    };

    /**
     * selector params :
     * left: 0,top:0,width:0 optional
     * height,ifrHeight: must
     * isInner,atHref optional
     */
    const baseParam = {
      isInner: window.self !== window.top,
      atHref: window.location.href,
      hostname: this.getHost(),
    };

    return { ...serializeDomRect, ...baseParam, ifrHeight };
  }

  setActivedTarget(target) {
    this.activedTarget = target || null;
  }

  sendTargetPosition(activedTarget) {
    if (
      !activedTarget ||
      !activedTarget.getBoundingClientRect() ||
      activedTarget.getBoundingClientRect().width === 0
    ) {
      return;
    }

    const domRect = activedTarget.getBoundingClientRect();

    const transportMsg = {
      posterId: this.getId(),
      extid: this.extid || '',
      nodeRootHref: window.location.href,
      domRects: [
        {
          uuid: this.getId(),
          domRect: JSON.parse(JSON.stringify(domRect)),
          iframeSrc: window.location.href,
          activedField: activedTarget === this.targetUsername ? 'username' : 'password',
        },
      ],
    };

    logger.debug('Actived Position Chains Message:>>>>>>', transportMsg, activedTarget);
    window.parent.postMessage(transportMsg, '*');
  }

  /**
   *
   * @param {element} activedTarget
   */
  getValtState(activedTarget) {
    const valtState = {
      activedField:
        activedTarget && activedTarget === this.targetPassword ? 'password' : 'username',
      hostname: this.getHost(),
      username: this.targetUsername ? this.targetUsername.value : '',
      password: this.targetPassword ? this.targetPassword.value : '',
    };
    return valtState;
  }

  checkLoginForm() {
    const { targetPassword, targetUsername } = lookupLoginFeildsInDom();
    this.targetPassword = targetPassword;
    this.targetUsername = targetUsername;

    const hasFinded = targetPassword && targetUsername;
    if (hasFinded) {
      const hostname = this.getHost();
      logger.debug('checkLoginForm>>>>>>>>>>>>>>', this.targetUsername, this.targetUsername);

      BindingFocusEvents.call(this);

      // send API_WIN_FINDED_LOGIN Message
      const findedData = {
        isInner: window.self !== window.top,
        senderId: this.getId(),
        href: window.location.href,
        hostname: hostname,
      };

      this._sendMessageToTop(API_WIN_FINDED_LOGIN, findedData);

      // actived resize observe
      this.emit('enabled:resize:obs');
      this.emit('actived:login:window:scroll-obs');
      if (window.self !== window.top) {
        //enabled listening message from top
        this.emit('enabled:private:msg-listener');
      }
      //actived zombie
      this.emit('actived:zombie-communication');
    }
  }
}

/* ---------------------------- File scope Internal functions ------------------------ */
function BindingFocusEvents() {
  const ctx = this;

  if (ctx.targetPassword) {
    bindingActivedFocusEvents(ctx.targetPassword);
  }
  if (ctx.targetUsername) {
    bindingActivedFocusEvents(ctx.targetUsername);
  }

  function bindingActivedFocusEvents(elem) {
    if (!elem) return;

    elem.addEventListener('focusin', (e) => {
      e.target.setAttribute('autocomplete', 'off');

      ctx.setActivedTarget(e.target);

      //send actived posi chains
      ctx.sendTargetPosition(e.target);

      const activedDomRect = e.target.getBoundingClientRect();

      // enabled input changed listener
      // emitter
      ctx.emit('enabled:input:valtChanged', e.target);

      const activedValtState = ctx.getValtState(e.target);
      // send to backend
      drawBPassButtonRoot.call(ctx, e);

      // calc send draw selector box sizeState
      const _complexParams = ctx.comboSizeCalcParams(e.target);
      const sizeState = ifrSizeCalcWhenValtChanged(_complexParams);

      const { elemType, ifrHeight, tag } = sizeState;
      logger.debug('FieldController::checkloginForm@focusin>>sizeState>>', tag, sizeState);
      const serializeDomRect = JSON.parse(JSON.stringify(activedDomRect));

      if (elemType === 'drawing') {
        const drawMessageData = ctx.comboSelectorBoxSendData(ifrHeight, serializeDomRect);
        ctx._sendMessageToTop(API_WIN_SELECTOR_DRAWER, drawMessageData);
      } else if (elemType === 'erase') {
        ctx.sendEraseSelectorBoxMessage(false, 'focusin');
      } else {
        /**do nothing */
      }
    });
    elem.addEventListener('focusout', (e) => {
      if (ctx.enabledFocusoutErase) {
        //remove icon when focusout
        document.querySelector(BPASS_BUTTON_TAG) &&
          document.querySelector(BPASS_BUTTON_TAG).remove();

        //TODO open commonent for debug
        ctx.sendEraseSelectorBoxMessage(false, 'focusout');
      }

      ctx.setActivedTarget(null);
      // disabled:input:valtChanged
      ctx.emit('disabled:input:valtChanged', e.target);
    });
  }
}

function drawBPassButtonRoot(evt) {
  const _ctx = this;
  const domRect = evt.target.getBoundingClientRect();
  const serializeRect = JSON.stringify(domRect);

  let passRoot = document.querySelector(BPASS_BUTTON_TAG);

  if (passRoot) {
    passRoot.remove();
  }
  passRoot = document.createElement(BPASS_BUTTON_TAG);
  passRoot.setAttribute('fctxid', _ctx.getId());

  document.body.appendChild(passRoot);

  setDomRect(passRoot, domRect);

  return passRoot;
}

function _updateBpassButtonPoistion(target) {
  const bpassButton = document.querySelector(BPASS_BUTTON_TAG);
  logger.debug('activedPositionResizeObserve>>_updateBpassButtonPoistion>>>>>', bpassButton);
  if (target && bpassButton) {
    const domRect = JSON.parse(JSON.stringify(target.getBoundingClientRect()));
    setDomRect(bpassButton, domRect);
  }
}

function setDomRect(elem, domRect) {
  const { left = 0, top = 0, width = 0, height = 0 } = domRect;

  elem.setAttribute('target-width', width);
  elem.setAttribute('target-height', height);
  elem.setAttribute('target-left', left);
  elem.setAttribute('target-top', top);

  elem.setAttribute('target-rect', JSON.stringify(domRect));
}

function lookupLoginFeildsInDom() {
  const ret = {
    targetPassword: null,
    targetUsername: null,
  };

  let _password = window.document.querySelector(PASSWORD_SELECTOR);

  if (!_password) {
    return ret;
  } else {
    //Fixed 163.com has two password input fields
    if (_password.style.display === 'none') {
      // logger.debug('163.com >>>>', _password.style.display);
      window.document.querySelectorAll(PASSWORD_SELECTOR).forEach((el) => {
        if (el.style.display !== 'none') {
          _password = el;
        }
      });
    }
  }

  let _username = null;

  if (_password.form) {
    //Fixed 163.com has two password
    _username =
      _password.form.querySelector(USERNAME_SELECTOR) &&
      _password.form.querySelector(USERNAME_SELECTOR).style.display !== 'none'
        ? _password.form.querySelector(USERNAME_SELECTOR)
        : null;

    //fixed pan|yun.baidu.com
    _username =
      _username &&
      _username.getBoundingClientRect() &&
      _username.getBoundingClientRect().width === 0
        ? null
        : _username;
  }

  if (_password && !_username) {
    _username = recursiveQuery(_password, USERNAME_SELECTOR);
  } else {
    logger.debug(
      'FeildController:mutationObsHandler:recursiveQuery>>>>>>>>>>>>>>>>>',
      _username.getBoundingClientRect()
    );
  }

  logger.debug('Lookup login fields:', _password, _username);
  if (!_password || !_username) {
    return ret;
  }

  return {
    targetPassword: _password,
    targetUsername: _username,
  };
}

/**
 * lookup target field logic
 * @param {*} target
 * @param {*} selector
 */
function recursiveQuery(target, selector) {
  if (!target) return null;
  const parentElem = target.parentElement || null;
  if (!parentElem || (!!parentElem.tagName && parentElem.tagName.toLowerCase() === 'body')) {
    return null;
  }

  let findElem = null;

  //fixed baidu&sina&163 has two feild and first display:none
  parentElem.querySelectorAll(selector).forEach((el) => {
    // fixed sina has multi input
    // find parent>first> display
    if (findElem === null && el.style.display !== 'none') {
      findElem = el;
      // logger.debug('find TargetUsername&&&&>>>>>>>>>>>>>>>>>', findElem);
    }

    //fixed Baidu dynamic
    if (
      findElem &&
      findElem.getBoundingClientRect() &&
      findElem.getBoundingClientRect().width === 0
    ) {
      if (el.getBoundingClientRect() && el.getBoundingClientRect().width > 0) {
        findElem = el;
      }
    }
  });

  if (!findElem || findElem.style.display === 'none') {
    return recursiveQuery(parentElem, selector);
  } else {
    return findElem;
  }
}

export default FieldController;
