import moment from 'moment';
import Web3 from 'web3';
import {
  ETH_TOKEN,
  BT_TOKEN,
  BPT_MEMBER,
  BT_APPRPOVE_ESGAS,
  BPT_MEMBER_RECHARGE_ESGAS,
  BPT_STORAGE_WEB_COMMIT_ESGAS,
  BPT_STORAGE_MOB_COMMIT_ESGAS,
} from '@lib/web3/contracts/enums';
import { wei2Ether, wei2Diamonds, compareWei } from '@lib/web3/web3-helpers';

/*********************************************************************
 * AircraftClass :: Migeration new features from firefox
 *		@description:
 *		@description:
 * WARNINGS:
 *
 * HISTORY:
 *		@author: lanbery@gmail.com
 *		@created:  2020-12-29
 *		@comments:
 **********************************************************************/
const diffHours = 0.5;

export const currentNetwork = (state) => {
  const currentChainId = state.chainId;
  return (
    state.networks.find((nw) => parseInt(nw.chainId) === parseInt(currentChainId)) ||
    state.networks[0]
  );
};

export const getEthBalanceText = (state) => {
  const { chainBalances = {} } = state;
  let ethWei = chainBalances[ETH_TOKEN] || '0';

  return wei2Ether(ethWei, 2);
};

export const getDiamondsText = (state) => {
  const { chainBalances = {} } = state;
  let ethWei = chainBalances[ETH_TOKEN] || '0';

  return wei2Diamonds(ethWei, 2);
};

export const getBTsBalanceText = (state) => {
  const { chainBalances = {} } = state;
  let ethWei = chainBalances[BT_TOKEN] || '0';

  return wei2Ether(ethWei, 2);
};

export const balanceExpired = (state) => {
  const currTs = new Date().getTime();
  const lasttimestamp = state.lasttimestamp;

  const diff = (currTs - lasttimestamp) / (1000 * 60 * 60);

  return diff >= diffHours;
};

export const getMembershipExpired = (state) => {
  const { chainStatus = {} } = state;
  const expired = chainStatus.membershipDeadline;
  if (!expired || expired === '0' || expired < 0) return '';
  const text = moment(new Date(expired * 1000)).format('YYYY-MM-DD');
  return text;
};

export const membershipCostBTsPerYear = (state) => {
  const { chainStatus = {} } = state;
  const wei = chainStatus.memberCostWeiPerYear;
  if (!wei) return '';
  return wei2Ether(wei, 0);
};

export const estimateBts = (state) => {
  const { chainStatus = {}, chainBalances = {}, gasState = {} } = state;

  const ethWei = chainBalances[ETH_TOKEN];
  if (!ethWei || ethWei == '0') return false;

  const btsWei = chainBalances[BT_TOKEN] || 0;
  const memberCostWeiPerYear = chainStatus.memberCostWeiPerYear || 0;

  if (compareWei(btsWei, memberCostWeiPerYear) < 0) {
    return false;
  }
  return true;
};

export const showRechargeBtn = (state) => {
  const { chainStatus = {}, chainBalances = {}, gasState = {} } = state;

  const ethWei = chainBalances[ETH_TOKEN];
  if (!ethWei || ethWei == '0') return false;

  const btsWei = chainBalances[BT_TOKEN] || 0;
  const memberCostWeiPerYear = chainStatus.memberCostWeiPerYear || 0;

  if (compareWei(btsWei, memberCostWeiPerYear) < 0) {
    return false;
  }
  return true;
};

export const validGasAndBtsEnought = (state) => {
  const { chainStatus = {}, chainBalances = {}, gasState = {} } = state;
  const ethWei = chainBalances[ETH_TOKEN];
  if (!ethWei || ethWei == '0') return false;
  const btsWei = chainBalances[BT_TOKEN] || 0;
  const memberCostWeiPerYear = chainStatus.memberCostWeiPerYear || 0;

  if (compareWei(btsWei, memberCostWeiPerYear) < 0) {
    return false;
  }

  return true;
};

export const currentMemberAllowance = (state) => {
  const { chainAllowance = {} } = state;
  return chainAllowance[BPT_MEMBER] || 0;
};

export const currentMemberAllowanceBT = (state) => {
  const { chainAllowance = {} } = state;
  const wei = chainAllowance[BPT_MEMBER] || '0';
  return Web3.utils.fromWei(wei, 'ether');
};

/**
 *
 * @param {object} state
 */
export const validNeedApprove = (state) => {
  const { chainStatus } = state;
  const memberCostWeiPerYear = chainStatus.memberCostWeiPerYear || 0;
  const allowanceWei = currentMemberAllowance(state);
  return compareWei(allowanceWei, memberCostWeiPerYear) < 0;
};

export const estimateApproved = (state) => {
  const statusState = state.chainStatus || {};
  return statusState[BT_APPRPOVE_ESGAS] || 21000;
};

export const estimateRecharged = (state) => {
  const statusState = state.chainStatus || {};
  return statusState[BPT_MEMBER_RECHARGE_ESGAS] || 21000;
};

export const estimateWebsiteCommit = (state) => {
  const statusState = state.chainStatus || {};
  return statusState[BPT_STORAGE_WEB_COMMIT_ESGAS] || 21000;
};

export const estimateMobileCommit = (state) => {
  const statusState = state.chainStatus || {};
  return statusState[BPT_STORAGE_MOB_COMMIT_ESGAS] || 21000;
};
