import { debounce } from 'lodash';
import { Mutex } from 'await-semaphore';
import EventEmitter from 'events';
import endOfStream from 'end-of-stream';
import PortStream from 'extension-port-stream';
import { nanoid } from 'nanoid';
import ObservableStore from 'obs-store';

import ComposableObservableStore from '../observestore/composable-obs-store.js';

import logger from '../logger/index.js';
import { buildExtVersion, buildExtAppName } from '../code-settings';
import ProfileController from './profile-controller';
import AccountController from './account-controller';

import NetworkController from '../network';
import Web3Controller from '../web3';

import WebsiteController from './website-controller';
import MobileController from './mobile-controller';
import { setupMultiplex } from '../helpers/pipe-helper.js';
import extension from '../extensionizer';

import {
  API_RT_INIT_STATE,
  API_JET_INIT_STATE,
  API_RT_FILL_FEILDS,
  API_PORT_FIELDS_VALT_CHANGED,
} from '../msgapi/api-types';

/*********************************************************************
 * AircraftClass ::
 *    @description: MainController entry
 *    @description: sub controller> getState is changed state struct
 *        for memStore, so when your define state key attention.
 *        So as not to be overwritten repeatedly
 *    @description:
 *        add changed network to update inject tabs support v2.1.6
 * WARNINGS:
 *      don't use store getFlatState ,it maybe cover by after append controller
 *      used same name keys
 * HISTORY:
 *     @Author: lanbery@gmail.com
 *     @Created:  2020-10-31
 *
 **********************************************************************/
class BackMainController extends EventEmitter {
  constructor(opts = {}) {
    super();

    this.defaultMaxListeners = 20;

    this.opts = opts;

    const initState = opts.initState || {};
    this.recordFirstTimeInfo(initState);

    /** management connections: */
    this.activeControllerConnections = 0;
    this.connections = {};

    /**
     * connection holder struct
     * {
     *  [tabId]:{
     *    hostname,
     *    muxStream,
     *    muxId,// optional
     *  }
     * }
     */
    /** Injet connections holder */
    this.topInjetConnections = {};

    /** Injet feilds connections by origin */
    this.injetOriginConnections = {};
    this.injetHostTabs = {};

    /** Leech */
    this.leechTabConnections = {};

    this.on('controllerConnectionChanged', (activeControllerConnections) => {});

    /** store:load form local storage */
    this.store = new ComposableObservableStore(initState);

    /**
     * 0. profileController
     * 1. accountController
     * 2. networkController
     * 3. web3Controller
     * 4. website
     * 5. mobile
     */
    //initState ==> will persistence locale storage
    this.profileController = new ProfileController({
      initState: initState.ProfileController,
    });

    // network
    this.networkController = new NetworkController({
      initState: initState.NetworkController,
    });

    this.accountController = new AccountController({
      initState: initState.AccountController,
    });

    /**
     * Web3
     */
    this.web3Controller = new Web3Controller({
      initState: initState.Web3Controller,
      getCurrentProvider: this.networkController.getCurrentProvider.bind(this.networkController),
      getCurrentWalletState: this.accountController.getCurrentWalletState.bind(
        this.accountController
      ),
    });

    /**
     * load state : {meta,data} => initState[xxController]
     *
     */
    this.websiteController = new WebsiteController({
      initState: initState.WebsiteController,
      getCurrentProvider: this.networkController.getCurrentProvider.bind(this.networkController),
      getCurrentWalletState: this.accountController.getCurrentWalletState.bind(
        this.accountController
      ),
      notifyInjet: this.notifiedAllInjetConnection.bind(this),
      getAllLiveOriginMuxStreams: this.getAllLiveOriginMuxStreams.bind(this), //version 2.1.6
      getAllLiveTopMuxStreams: this.getAllLiveTopMuxStreams.bind(this), //version 2.1.6
      getAllLiveLeechMuxStreams: this.getAllLiveLeechMuxStreams.bind(this),

      notifyCurrentTabActivedLeech: this.notifyCurrentTabActivedLeech.bind(this),

      getActivedTabInfo: this.getCurrentActivedTabJetInfo.bind(this),

      notifyActivedLeech: this.notifyActivedLeech.bind(this),
    });

    this.mobileController = new MobileController({
      initState: initState.MobileController,
      getCurrentProvider: this.networkController.getCurrentProvider.bind(this.networkController),
      getCurrentWalletState: this.accountController.getCurrentWalletState.bind(
        this.accountController
      ),
    });

    /** binding store state changed subscribe to update store value */
    // when key
    this.store.updateStructure({
      AccountController: this.accountController.store,
      NetworkController: this.networkController.store,
      Web3Controller: this.web3Controller.store,
      WebsiteController: this.websiteController.store,
      MobileController: this.mobileController.store,
    });

    /**
     * memStore
     * getFlatState : only use get Public state
     *
     */
    this.memStore = new ComposableObservableStore(null, {
      AccountController: this.accountController.memStore,
      WebsiteController: this.websiteController.memStore,
      MobileController: this.mobileController.memStore,
    });
    //sub
    this.memStore.subscribe(this.memStoreWatch.bind(this));

    // notified the browser opened login pages

    //管理
    this.activeLoginStore = new ObservableStore({ operType: 'init', password: '', username: '' });

    /** ++++++++++++++ Listeners Registed +++++++++++++++ */
    this.once('ctx:runtime:initial', _runtimeStartupHandler.bind(this));

    this.on(
      'ctx:send:zombieState:toAll:communications:delay',
      debounce(this.sendToAllInjectMuxStreams.bind(this), 200)
    );
  }

  memStoreWatch(state) {
    logger.debug('BackMainController:memStoreWatch>>>>', state);
  }

  /**
   *
   * @param {*} remotePort
   */
  setupTrustedCommunication(remotePort) {
    const portStream = new PortStream(remotePort);
    endOfStream(portStream, (err) => {
      logger.debug(
        'BackMainController:setupTrustedCommunication disconnect. >>>>',
        err,
        portStream
      );
    });
    this.sendInitStateToTrustedUI(portStream, remotePort.sender);
  }

  /**
   * send initState to UI remotePort
   * @param {*} connectionStream
   * @param {*} sender
   */
  sendInitStateToTrustedUI(connectionStream, sender) {
    const mux = setupMultiplex(connectionStream);
    const stream = mux.createStream(API_RT_INIT_STATE);
    const data = this.getState();
    stream.write(data);
  }

  /** =============================== Top injet communication code start ====================================== */
  async setupInjetTopCommunication(port) {
    const sender = port.sender;
    logger.debug(
      'BackMainController:setupInjetTopCommunication- listen connected>>>>',
      sender,
      port
    );

    if (!sender || !sender.tab) return;

    const { tab, origin, id } = sender;
    const tabId = tab.id;

    const portStream = new PortStream(port);

    /**
     * 处理异常断开
     */
    endOfStream(portStream, (err, result) => {
      logger.debug(
        'BackMainController:setupInjetTopCommunication disconnect.',
        tabId,
        origin,
        result
      );
      this.detleteTopInjetConnections(tabId);
    });

    const mux = setupMultiplex(portStream);
    const muxId = `BPTop-${nanoid()}`;
    const muxStream = mux.createStream(muxId);
    this.addTopInjetConnections(tabId, muxId, muxStream);

    /**
     * Injet valt changed
     */
    port.onMessage.addListener(async (message) => {
      logger.debug(
        'BackMainController:setupInjetTopCommunication--Received Message',
        message,
        tabId
      );
      if (message && message.hostname) {
        this.setTopInjetConnectionHostname(tabId, message.hostname);
        const respData = await this.getSendZombieState(message.hostname);

        //send
        muxStream.write({ apiType: API_JET_INIT_STATE, respData });
      }
    });
  }

  /**
   *
   * @param {*} tabId
   * @param {*} muxId
   * @param {*} muxStream
   */
  addTopInjetConnections(tabId, muxId, muxStream) {
    if (tabId === undefined || !muxStream) return;
    if (!this.topInjetConnections) {
      this.topInjetConnections = {};
    }
    this.topInjetConnections[tabId] = {
      muxId,
      muxStream,
    };
  }

  setTopInjetConnectionHostname(tabId, hostname) {
    if (tabId === undefined || !hostname || !this.topInjetConnections) return;

    if (this.topInjetConnections[tabId]) {
      this.topInjetConnections[tabId]['hostname'] = hostname;
    }
  }

  /**
   *
   * @param {string} hostname
   */
  getTopInjetHostConnections(hostname) {
    if (!hostname || !this.topInjetConnections) return [];
    const hostConnections = [];

    Object.keys(this.topInjetConnections).forEach((k) => {
      const tabConnection = this.topInjetConnections[k];
      if (tabConnection.hostname.endsWith(hostname)) {
        hostConnections.push(tabConnection.muxStream);
      }
    });

    return hostConnections;
  }

  detleteTopInjetConnections(tabId) {
    if (tabId === undefined || !this.topInjetConnections || !this.topInjetConnections[tabId]) {
      return;
    }

    delete this.topInjetConnections[tabId];
  }

  /** =============================== Top injet communication code end ====================================== */
  async lockingNotifyAllCommunications() {
    const conns = [];
    if (this.topInjetConnections) {
      Object.values(this.topInjetConnections).forEach((conn) => {
        conns.push(conn);
      });
    }

    if (this.injetOriginConnections) {
      Object.values(this.injetOriginConnections).forEach((conn) => {
        conns.push(conn);
      });
    }

    if (conns.length > 0) {
      const inistState = {
        apiType: API_JET_INIT_STATE,
        respData: { isUnlocked: false, items: [], matchedNum: 0 },
      };
      conns.forEach((conn) => {
        logger.debug('BackMainController::Locking notify>>>>', conn.muxId);
        if (conn.muxStream) {
          conn.muxStream.write(inistState);
        }
      });
    }
  }
  /** =============================== Field injet communication code start ====================================== */
  async setupInjetCommunication(port) {
    const sender = port.sender;
    logger.debug(
      'BackMainController:setupInjetSubCommunication- listen connected>>>>',
      sender,
      port
    );
    if (!sender || !sender.tab) return;
    const { tab, origin, id } = sender;
    const tabId = tab.id;

    let hostname = '';
    try {
      hostname = new URL(origin).hostname;
    } catch (ex) {
      logger.debug(`get hostname err [${origin}]:`, ex);
    }
    if (!hostname) {
      return;
    }

    // listening remote message

    port.onMessage.addListener((message) => {
      const _ctx = this;
      if (!message || !message.apiType) return;

      const { reqData } = message;
      logger.debug('injetValtListener>>>>', reqData, this, tabId);
      switch (message.apiType) {
        case API_PORT_FIELDS_VALT_CHANGED:
          this.websiteController.updateActivedTabValtState.bind(this.websiteController);
          this.websiteController.updateActivedTabValtState(tabId, reqData);
          break;
        default:
          break;
      }
    });

    logger.debug('BackMainController:setupInjetSubCommunication>origin>>>', origin, hostname);
    const portStream = new PortStream(port);

    const mux = setupMultiplex(portStream);
    const muxId = `BPinjet-${nanoid()}`;
    const muxStream = mux.createStream(muxId);

    logger.debug('BackMainController:setupInjetSubCommunication connected.', muxId);
    /**
     * 处理异常断开
     */
    endOfStream(portStream, (err) => {
      logger.debug('BackMainController:setupInjetSubCommunication disconnect.', err, muxId, tabId);
      this.websiteController.disconnectResetActivedTabValtState(tabId);
      this.deleteInjetOriginConnections(tabId);
    });

    this.addInjetOriginConnections({ tabId, hostname, muxId, muxStream });
    const respData = await this.getSendZombieState(hostname);
    logger.debug('BackMainController:setupInjetSubCommunication Send first init state.', respData);
    muxStream.write({ apiType: API_JET_INIT_STATE, respData });

    // add origin/tabId
  }

  injetValtChangedHandle(message) {
    logger.debug('injetValtListener>>>>', message, this);
  }

  /**
   * sendData {items,isUnlock,hostname,valtState}
   * @param {number|string} tabId
   */
  async notifyActivedLeech(tabId) {
    const connection = this.getLeechConnection(tabId);
    if (connection && connection.muxStream && connection.hostname) {
      const data = await this.getLeechSendState(tabId, connection.hostname);
      connection.muxStream.write(data);
    }
  }

  /**
   * 通知 active Tab leech page
   */
  notifyCurrentTabActivedLeech() {
    extension.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs && tabs.length && tabs[0]) {
        const tabId = tabs[0].id;
        this.notifyActivedLeech(tabId);
      }
    });
  }

  /**
   *
   * @param {string} hostname
   */
  getInjetOriginConnections(hostname) {
    if (
      !hostname ||
      !this.injetOriginConnections ||
      Object.keys(this.injetOriginConnections).length === 0
    )
      return [];
    let connections = [];

    for (let tabId in this.injetOriginConnections) {
      let connObj = this.injetOriginConnections[tabId];
      if (connObj.hostname === hostname && connObj.muxStream) {
        connections.push(connObj.muxStream);
      }
    }
    return connections;
  }

  getInjetOriginConnectionByTab(tabId) {
    let connection = null;
    if (tabId === undefined || !this.injetOriginConnections || !this.injetOriginConnections[tabId])
      return connection;

    return this.injetOriginConnections[tabId].muxStream;
  }

  deleteInjetOriginConnections(tabId) {
    if (!this.injetOriginConnections || !this.injetOriginConnections[tabId]) return;
    delete this.injetOriginConnections[tabId];
  }

  /**
   * find tabId => hostname
   * @param {number} tabId
   */
  getTabLoginHostname(tabId) {
    if (tabId === undefined) return false;
    return this.injetOriginConnections && this.injetOriginConnections[tabId]
      ? this.injetOriginConnections[tabId].hostname
      : false;
  }

  /**
   *
   * @param {object} param0
   */
  addInjetOriginConnections({ tabId, hostname, muxId, muxStream }) {
    if (!hostname || !muxId || !muxStream || tabId === undefined) return;

    if (!this.injetOriginConnections) {
      this.injetOriginConnections = {};
    }

    /** injetOriginConnections : feature update struct tabId> hostname > {muxId,muxStream}*/
    if (!this.injetOriginConnections[tabId]) {
      this.injetOriginConnections[tabId] = {
        hostname: hostname,
        muxId: muxId,
        muxStream: muxStream,
      };
    } else {
      this.injetOriginConnections[tabId] = {
        hostname: hostname,
        muxId: muxId,
        muxStream,
      };
    }
  }

  /**
   * return tabInfo {tabId,hostname} or false
   */
  async getCurrentActivedTabJetInfo() {
    const jetCommunications = this.injetOriginConnections;
    return new Promise((resolve, reject) => {
      extension.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs && tabs.length && tabs[0]) {
          const tabId = tabs[0].id;
          const _conn = jetCommunications[tabId];
          const hostname = _conn ? _conn.hostname : '';
          return resolve({ tabId, hostname });
        } else {
          return resolve(false);
        }
      });
    });
  }
  /** =============================== Field injet communication code end ====================================== */

  /** ++++++++++++++++++++++++++++++++++++ Leech Begin +++++++++++++++++++++++++++++++++++++++++++++  */
  /**
   * 设置 Leech MuxStream
   * @param {*} port
   */
  async setupLeechCommunication(port) {
    const sender = port.sender;
    if (!sender) return;
    const { tab } = sender;
    const tabId = tab.id;
    let hostname = this.getTabLoginHostname(tabId);
    const portStream = new PortStream(port);

    logger.debug('BackMainController:LeechCommunication >>>>>>.', sender, hostname);
    const mux = setupMultiplex(portStream);
    const muxId = `BPLeech-${nanoid()}`;
    const muxStream = mux.createStream(muxId);
    /**
     * 处理异常断开
     */
    endOfStream(portStream, () => {
      logger.debug('BackMainController:LeechCommunication disconnect.', muxId, tabId);
      if (this.leechTabConnections && this.leechTabConnections[tabId]) {
        delete this.leechTabConnections[tabId];
      }
    });

    if (hostname) {
      this.addLeechConnections(tabId, muxStream, hostname);
      const data = await this.getLeechSendState(tabId, hostname);
      muxStream.write(data);
    }
  }

  addLeechConnections(tabId, muxStream, hostname) {
    if (!this.leechTabConnections) {
      this.leechTabConnections = {};
    }
    this.leechTabConnections[tabId] = {
      hostname,
      muxStream,
    };
  }

  getLeechConnection(tabId) {
    return this.leechTabConnections ? this.leechTabConnections[tabId] : false;
  }

  /**
   *
   * @param {*} tabId
   * @param {*} item
   */
  filledLoginFeilds(tabId, item) {
    //
    logger.debug('BackMainController:filledLoginFeilds >>>>>', tabId, item);
    const muxStream = this.getInjetOriginConnectionByTab(tabId);

    muxStream.write({ apiType: API_RT_FILL_FEILDS, respData: item });
    return true;
  }

  /** ++++++++++++++++++++++++++++++++++++ Leech End +++++++++++++++++++++++++++++++++++++++++++++  */

  /**
   * Warning : this method will change store structor
   */
  getState() {
    const { env3 } = this.accountController.store.getState();
    const { isUnlocked } = this.accountController.memStore.getState();

    const NetworkController = this.networkController.getSendState();
    const { chainId } = NetworkController || {};
    let Web3Controller = {};
    if (chainId) {
      Web3Controller = this.web3Controller.getSendState(chainId);
    }

    return {
      isUnlocked: Boolean(isUnlocked),
      isInitialized: Boolean(env3),
      ...this.memStore.getState(),
      NetworkController,
      Web3Controller,
    };
  }

  recordFirstTimeInfo(initState) {
    if (!('firstTimeInfo' in initState)) {
      initState.firstTimeInfo = {
        version: buildExtVersion,
        date: Date.now(),
      };
    }
  }

  /**
   * website item changed notify
   * topPage and feildsPage
   * @param {string} hostname
   */
  async notifiedAllInjetConnection(hostname) {
    if (!hostname) return;

    const respData = await this.getSendZombieState(hostname);

    // TOP page
    const connections = this.getTopInjetHostConnections(hostname);
    if (connections.length > 0) {
      connections.forEach((muxStream) => {
        try {
          logger.warn('Inject connection send state .....', hostname, respData);

          muxStream.write({ apiType: API_JET_INIT_STATE, respData });
        } catch (err) {
          logger.warn('Inject connection send state to TopPage failed.', err);
        }
      });
    }

    const feildConnections = this.getInjetOriginConnections(hostname);
    if (feildConnections.length > 0) {
      feildConnections.forEach((muxStream) => {
        try {
          muxStream.write({ apiType: API_JET_INIT_STATE, respData });
        } catch (err) {
          logger.warn('Inject connection send state to FeildsPage failed.', err);
        }
      });
    }
  }

  async getSendZombieState(hostname) {
    const { isUnlocked } = await this.accountController.memStore.getState();
    const zombieState = await this.websiteController.getZombieState(hostname);

    return {
      isUnlocked: Boolean(isUnlocked),
      ...zombieState,
    };
  }

  /**
   *
   * @param {*} tabId
   * @param {*} feildValues
   */
  async getLeechSendState(tabId, hostname) {
    const { isUnlocked } = this.accountController.memStore.getState();
    let { items = [] } = await this.websiteController.memStore.getState();

    const wholeValtState = this.websiteController.valtStore.getState();
    const valtState = typeof wholeValtState === 'object' ? wholeValtState[tabId] : {};

    if (items.length > 0 && hostname) {
      items = items.filter((it) => hostname.endsWith(it.hostname));
    } else {
      items = []; //
    }

    return {
      isUnlocked,
      hostname,
      items,
      valtState,
    };
  }

  /**
   *
   */
  getAllLiveTopMuxStreams() {
    return typeof this.topInjetConnections === 'object'
      ? Object.values(this.topInjetConnections)
      : [];
  }

  /**
   *
   */
  getAllLiveOriginMuxStreams() {
    return typeof this.injetOriginConnections === 'object'
      ? Object.values(this.injetOriginConnections)
      : [];
  }

  getAllLiveLeechMuxStreams() {
    return typeof this.leechTabConnections === 'object'
      ? Object.values(this.leechTabConnections)
      : [];
  }

  /**
   * 同步数据到webpage inject holders
   */
  async sendToAllInjectMuxStreams() {
    const originConns = this.injetOriginConnections
      ? Object.values(this.injetOriginConnections)
      : [];
    originConns.forEach(async (jetConns) => {
      const { hostname, muxStream, muxId } = jetConns;
      if (hostname && muxStream) {
        const respData = await this.getSendZombieState(hostname);
        muxStream.write({ apiType: API_JET_INIT_STATE, respData });
      }
    });

    const topConns = this.topInjetConnections ? Object.values(this.topInjetConnections) : [];
    topConns.forEach(async (conns) => {
      const { hostname, muxStream, muxId } = conns;
      if (hostname && muxStream) {
        const respData = await this.getSendZombieState(hostname);
        muxStream.write({ apiType: API_JET_INIT_STATE, respData });
      }
    });
  }
}

export default BackMainController;
/** ================================ File Scope Private Functions ====================================== */

/**
 * Extension first startup, runtime loading.
 */
async function _runtimeStartupHandler() {
  logger.debug('Backend started initialzing...');
  this.web3Controller.emit('web3:reload:gasStation:delay');
  await this.networkController.emit('network:ping:noerror');

  const { selectedAddress } = this.accountController.getCurrentWalletState();
  const provider = this.networkController.getCurrentProvider();
  if (provider) {
    this.web3Controller.emit('web3:reload:chain:config-base-noerror', provider);
  }

  if (selectedAddress && provider) {
    this.web3Controller.emit('web3:reload:balances:delay');
    this.web3Controller.emit('web3:reload:chain:status-noerror', provider, selectedAddress);
  }
}

/**
 * Extensiong account login Loading
 * this function will handler :
 * Asynchronous loading data function
 */
async function _loginInitializeHandler() {}
