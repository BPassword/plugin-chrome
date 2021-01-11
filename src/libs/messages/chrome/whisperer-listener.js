import extension from '@lib/extensionizer';
import logger from '@lib/logger';
import BizError from '@lib/biz-error';
import { APITYPE_ILLEGAL } from '@lib/biz-error/error-codes';

import { buildResponseMessage, buildErrorResponseMessage } from './data-struct-helper';

import {
  API_RT_CREATE_WALLET,
  API_RT_IMPORT_WALLET,
  API_RT_LOGIN_WALLET,
  API_RT_LOGOUT_WALLET,
  API_RT_ADD_WEB_ITEM,
  API_RT_EDIT_WEB_ITEM,
  API_RT_DELETE_WEB_ITEM,
  API_RT_ADD_MOB_ITEM,
  API_RT_EDIT_MOB_ITEM,
  API_RT_DELETE_MOB_ITEM,
  API_RT_FILL_FEILDS,
  API_RT_CHANGED_NETWORK,
  API_RT_RELOAD_CHAIN_BALANCES,
  API_RT_FETCH_BTAPPROVED_RAW_DATA,
  API_RT_FETCH_REGIST_MEMBER_RAW_DATA,
  API_RT_ADDORUP_TX_STATE,
  API_RT_SYNC_WEBSITE_DATA,
  API_RT_FETCH_WEBSITE_COMMIT_RAWDATA,
  API_RT_SYNC_MOBILE_DATA,
  API_RT_FETCH_MOBILE_COMMIT_RAWDATA,
} from '../../msgapi/api-types';
import { INTERNAL_ERROR } from '../../biz-error/error-codes';

/*********************************************************************
 * AircraftClass :: Refactor For Chrome
 *		@description: Optimization switch code
 *		@description: Migeration new features from firefox blockchain.
 * WARNINGS:
 *
 * HISTORY:
 *		@author: lanbery@gmail.com
 *		@created:  2020-11-09
 *		@comments:
 **********************************************************************/
class WhispererListener {
  constructor({ controller }) {
    this.controller = controller;
    extension.runtime.onMessage.addListener(_handlerWhispererNessage.bind(this));
  }

  async createWallet(reqData) {
    const { password } = reqData;
    const { env3 } = await this.controller.accountController.createWallet(password);

    // init website & mobile pass items
    const { dev3 } = this.controller.accountController.getCurrentWalletState();
    await this.controller.websiteController.unlock(dev3.SubPriKey);
    await this.controller.mobileController.unlock(dev3.SubPriKey);

    const initState = this.controller.getState();
    return { ...initState, env3 };
  }

  async importWallet(reqData) {
    const { env3, password } = reqData;

    const retState = await this.controller.accountController.importWallet(env3, password);

    // init website & mobile pass items
    const subPriKey = await this.controller.accountController.getSubPriKey();
    await this.controller.websiteController.unlock(subPriKey);
    await this.controller.mobileController.unlock(subPriKey);

    const initState = this.controller.getState();

    return { ...initState, ...retState };
  }

  async login(reqData) {
    const { password } = reqData;
    const { dev3 } = await this.controller.accountController.unlock(password);

    //init website & mobile pass items
    await this.controller.websiteController.unlock(dev3.SubPriKey);
    await this.controller.mobileController.unlock(dev3.SubPriKey);

    const initState = this.controller.getState();
    return initState;
  }

  async logout() {
    const ret = await this.controller.accountController.lock();
    await this.controller.websiteController.locked();
    await this.controller.mobileController.locked();
    const initState = this.controller.getState();
    return initState;
  }

  async addWebsiteItem(reqData) {
    const { dev3 } = this.controller.accountController.getCurrentWalletState();
    const respData = await this.controller.websiteController.addItem(dev3.SubPriKey, reqData);
    return respData;
  }

  async updateWebsiteItem(reqData) {
    const { dev3 } = this.controller.accountController.getCurrentWalletState();
    const respData = await this.controller.websiteController.updateItem(dev3.SubPriKey, reqData);
    return respData;
  }

  async deleteWebsiteItem(reqData) {
    const { dev3 } = this.controller.accountController.getCurrentWalletState();
    const respData = await this.controller.websiteController.deleteItem(dev3.SubPriKey, reqData);
    return respData;
  }

  async addMobileItem(reqData) {
    const prikey = await this.controller.accountController.getSubPriKey();
    const respData = await this.controller.mobileController.addItem(prikey, reqData);
    return respData;
  }

  async updateMobileItem(reqData) {
    const prikey = await this.controller.accountController.getSubPriKey();
    const respData = await this.controller.mobileController.updateItem(prikey, reqData);
    return respData;
  }

  async deleteMobileItem(reqData) {
    const prikey = await this.controller.accountController.getSubPriKey();
    const respData = await this.controller.mobileController.deleteItem(prikey, reqData);
    return respData;
  }

  async filledFields(reqData, sender) {
    if (!reqData) {
      throw new BizError('filled item data miss', INTERNAL_ERROR);
    }
    if (!sender || !sender.tab) {
      throw new BizError(`Filled only can used on browser page.`, INTERNAL_ERROR);
    }

    const tabId = sender.tab.id;
    try {
      const ret = this.controller.filledLoginFeilds(tabId, reqData);
      return true;
    } catch (err) {
      logger.debug('filledFields>>>', reqData);
      return false;
    }
  }

  async changedNetworkState(reqData) {
    const networkState = await this.controller.networkController.changedNetwork(reqData);
    const currentProvider = this.controller.networkController.getCurrentProvider();
    const walletState = this.controller.accountController.getCurrentWalletState();
    const { selectedAddress } = walletState;
    await this.controller.web3Controller.emit(
      'web3:reload:chain:status-noerror',
      currentProvider,
      selectedAddress
    );

    await this.controller.web3Controller.emit(
      'web3:reload:chain:config-base-noerror',
      currentProvider
    );

    const WebsiteController = await this.controller.websiteController.reinitializeCypher(false);
    const MobileController = await this.controller.mobileController.reinitializeCypher(false);

    const web3State = await this.controller.web3Controller.reloadBalances();

    // let notifyAllInjectTask = this.controller.sendToAllInjectMuxStreams.bind(this.controller);
    // notifyAllInjectTask();

    this.controller.emit('ctx:send:zombieState:toAll:communications:delay');

    // this.controller.websiteController.emit('notify:allinject:tabs:state');

    //emit('notify:allinject:tabs:state')
    return {
      NetworkController: networkState,
      Web3Controller: web3State,
      WebsiteController,
      MobileController,
    };
  }

  async reloadTokenBalances(reqData) {
    return this.controller.web3Controller.reloadBalances();
  }

  async signedForBTApproved(reqData) {
    return this.controller.web3Controller.signedBTApproved4Member(reqData);
  }

  async signedForRegistMember(reqData) {
    return this.controller.web3Controller.signedRegistedMemberByYear(reqData);
  }

  /**
   *
   * @param {object} reqData
   */
  async addOrUpdateChainTxState(reqData) {
    if (typeof reqData !== 'object') {
      throw new BizError('txState illegal. it must contain reqId,chainId,txHash', INTERNAL_ERROR);
    }
    const { reqId } = reqData;
    const chainTxs = await this.controller.web3Controller.chainTxStatusUpdateForUI(reqData);

    return {
      reqId,
      chainTxs,
    };
  }

  async pullWebsiteChainData(reqData) {
    return this.controller.websiteController.fetchMergeFromBlockChain();
  }

  async signedWebsiteCommitRawData(reqData) {
    const { reqId, gasPriceSwei } = reqData;
    const cypher64 = await this.controller.websiteController.getCypher64();
    if (!cypher64) {
      throw new BizError('miss locale cypher data.', INTERNAL_ERROR);
    }

    const respState = await this.controller.web3Controller.signedWebsiteCommitCypher(
      reqId,
      gasPriceSwei,
      cypher64
    );

    return respState;
  }

  async pullMobileChainData(reqData) {
    return this.controller.mobileController.fetchMergeFromBlockChain();
  }

  async signedMobileCommitRawData(reqData) {
    const { reqId, gasPriceSwei } = reqData;
    const cypher64 = await this.controller.mobileController.getCypher64();
    if (!cypher64) {
      throw new BizError('miss locale cypher data.', INTERNAL_ERROR);
    }

    const respState = await this.controller.web3Controller.signedMobileCommitCypher(
      reqId,
      gasPriceSwei,
      cypher64
    );

    return respState;
  }
}

export default WhispererListener;

function _handlerWhispererNessage(message, sender, sendResponse) {
  const isFn = typeof sendResponse === 'function';
  if (typeof message !== 'object' && !message.apiType) {
    return false;
  } else {
    logger.debug(`WhispererListener Received untrusted:senderId:[${sender.id}] >>>`, message);
  }
  const { apiType, reqData } = message;
  logger.debug(`WhispererListener :[${apiType}] >>>`, isFn, reqData);
  let promise = new Promise(async (resovle, rejcet) => {
    try {
      let data = '';
      switch (apiType) {
        case API_RT_CREATE_WALLET:
          data = await this.createWallet(reqData);
          break;
        case API_RT_IMPORT_WALLET:
          data = await this.importWallet(reqData);
          break;
        case API_RT_LOGIN_WALLET:
          data = await this.login(reqData);
          break;
        case API_RT_LOGOUT_WALLET:
          data = await this.logout();
          break;
        case API_RT_ADD_WEB_ITEM:
          data = await this.addWebsiteItem(reqData);
          break;
        case API_RT_EDIT_WEB_ITEM:
          data = await this.updateWebsiteItem(reqData);
          break;
        case API_RT_DELETE_WEB_ITEM:
          data = await this.deleteWebsiteItem(reqData);
          break;
        case API_RT_ADD_MOB_ITEM:
          data = await this.addMobileItem(reqData);
          break;
        case API_RT_EDIT_MOB_ITEM:
          data = await this.updateMobileItem(reqData);
          break;
        case API_RT_DELETE_MOB_ITEM:
          data = await this.deleteMobileItem(reqData);
          break;
        case API_RT_FILL_FEILDS:
          data = await this.filledFields(reqData, sender);
          break;
        case API_RT_CHANGED_NETWORK:
          data = await this.changedNetworkState(reqData);
          break;
        case API_RT_RELOAD_CHAIN_BALANCES:
          data = await this.reloadTokenBalances(reqData);
          break;
        case API_RT_ADDORUP_TX_STATE:
          data = await this.addOrUpdateChainTxState(reqData);
          break;
        case API_RT_FETCH_BTAPPROVED_RAW_DATA:
          data = await this.signedForBTApproved(reqData);
          break;
        case API_RT_FETCH_REGIST_MEMBER_RAW_DATA:
          data = await this.signedForRegistMember(reqData);
          break;
        case API_RT_SYNC_WEBSITE_DATA:
          data = await this.pullWebsiteChainData(reqData);
          break;
        case API_RT_FETCH_WEBSITE_COMMIT_RAWDATA:
          data = await this.signedWebsiteCommitRawData(reqData);
          break;
        case API_RT_SYNC_MOBILE_DATA:
          data = await this.pullMobileChainData(reqData);
          break;
        case API_RT_FETCH_MOBILE_COMMIT_RAWDATA:
          data = await this.signedMobileCommitRawData(reqData);
          break;
        default:
          throw new BizError(`Unsupport ApiType: ${apiType}.`, APITYPE_ILLEGAL);
      }

      if (isFn) {
        logger.debug('Whisperer response data >>>>>', data);
        sendResponse(await buildResponseMessage(apiType, data));
      }
    } catch (err) {
      if (isFn) {
        sendResponse(await buildErrorResponseMessage(apiType, err));
      } else {
        logger.debug(`Whisperer Handler ${apiType} message failed.`, err.message);
      }
    }
  });

  if (isFn) {
    return true;
  }
}
