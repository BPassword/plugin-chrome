import { LOG_LEVEL } from '@lib/code-settings';

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

export function bpassButtonBuillder(jetid, extState = {}) {
  const serializeConfig = JSON.stringify(extState);
  const jetContent = `
    /**Bpassword inject */\n
    (function(jetid,serializeConfig,ll){
      class BpassButton extends HTMLElement {
        constructor(){
          super();
          this.uuid = jetid;
          this.extState = JSON.parse(serializeConfig);

          let shadow = this.shadowRoot;

          !shadow&&(shadow=this.attachShadow({mode:'open'}));

          this.drawInnerElements = _drawInnerElements.bind(this);
          this.updateStyles = _updateStyles.bind(this);

          this.drawInnerElements();
        }

        connectedCallback() {this.updateStyles();}
        disconnectedCallback() {}

        static get observedAttributes(){
          return ['icon-size', 'target-width', 'target-height', 'target-left', 'target-top','target-rect'];
        }

        attributeChangedCallback(name, oldValue, newValue) {
          this.updateStyles();
        }
      }

      BpassButton.medium = 16;
      BpassButton.large = 26;
      BpassButton.small = 12;

      BpassButton.calcIconSize = (h)=>{
        if (!h) return BpassButton.small;
        if (parseFloat(h) >= 38) return BpassButton.large;
        if (parseFloat(h) >= BpassButton.medium + 4) return BpassButton.medium;
        return BpassButton.small;
      }

      function _updateStyles(){
        const shadow = this.shadowRoot;
        let paddingY = 0,left = parseFloat(this.getAttribute('target-left') || '0'),top = parseFloat(this.getAttribute('target-top') || '0'),width = parseFloat(this.getAttribute('target-width') || '0'),height = parseFloat(this.getAttribute('target-height') || '0');

        const iconSize = BpassButton.calcIconSize(height);
        let space = Math.max((height - iconSize) / 2, paddingY),iconLeft = left + (width - iconSize - space),iconTop = top + space;
        shadow.querySelector('style').textContent = ' button {' +
          'all:initial;cursor:pointer;position:fixed;float:left;'+
          'left:'+iconLeft+'px;top:'+iconTop+'px;'+
          'height:'+iconSize+'px;width:'+iconSize+'px;'+
          'color:#8cc;'+
          "background: url(\'data:image/png;base64,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\') center center no-repeat;"+
          'background-size: cover;border:none;outline:0; }';
      }

      function _drawInnerElements(){
        const shadow = this.shadowRoot;
        let styles = shadow.querySelector('button');

        if(!styles){
          styles = document.createElement('style');
          shadow.appendChild(styles);
        }else{
          console.warn('BPassButton shadow style exists. undraw.');
        }

        let btnEl = shadow.querySelector('button');
        if(!btnEl){
          (btnEl=document.createElement('button'))&&(shadow.appendChild(btnEl));
        }else {
          console.warn('BPassButton shadow button exists. undraw.');
        }

        shadow.addEventListener('mousedown',(e)=>{
          e.stopImmediatePropagation();
          e.preventDefault();
        });

        shadow.addEventListener('click', (e) => {
          let onClickFn = this.onclick;

          (ll === 'DEBUG') && console.log('BpassButton click>>>>',e.target, window.location.href);

          _activedPosiChain.call(this);
          e.stopImmediatePropagation();
          e.preventDefault();
        });
      }

      function _activedPosiChain(){
        const shadowHost = this.shadowRoot?.host;
        const domRectString = shadowHost.getAttribute('target-rect');
        (ll === 'DEBUG')&&console.log('BpassButton click>>>>',domRectString, this.extState);
        let domRect = undefined;
        try{!!domRectString && (domRect=JSON.parse(domRectString));}catch(err){}
        let fctxid = shadowHost.getAttribute('fctxid')||'';
        const extState = this.extState||{};
        const payload = {fctxid,extid:extState.extid||'',command:'toggler',data:{domRect}};
        window.dispatchEvent(new CustomEvent("bpass:buuton:toggler",{detail:payload}))
      }

      window.customElements.define('bpass-button',BpassButton);

    })('${jetid}','${serializeConfig}','${LOG_LEVEL}');
  `;

  return jetContent;
}
