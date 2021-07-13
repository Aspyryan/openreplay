import Peer, { MediaConnection } from 'peerjs';
import type { DataConnection } from 'peerjs';
import { App, Messages } from '@openreplay/tracker';
import type Message from '@openreplay/tracker';

import Mouse from './Mouse';
import CallWindow from './CallWindow';
import Confirm from './Confirm';


export interface Options {
  confirmText: string,
  confirmStyle: Object, // Styles object
}


export default function(opts: Partial<Options> = {})  {
  const options: Options = Object.assign(
    { 
      confirmText: "You have a call. Do you want to answer?",
      confirmStyle: {},
    },
    opts,
  );
  return function(app: App | null, appOptions: { __DISABLE_SECURE_MODE?: boolean } = {}) {
    // @ts-ignore
    if (app === null || !navigator?.mediaDevices?.getUserMedia) { // 93.04% browsers
      return;
    }


    let callingPeerDataConn
    app.attachStartCallback(function() {
//            new CallWindow(()=>{console.log('endcall')});

      // @ts-ignore
      const peerID = `${app.projectKey}-${app.getSessionID()}`
      const peer = new Peer(peerID, {
              // @ts-ignore
        host: app.getHost(),
        path: '/assist',
        port: location.protocol === 'http:' && appOptions.__DISABLE_SECURE_MODE ? 80 : 443,
      });
      console.log(peerID)
      peer.on('connection', function(conn) { 
        console.log('connection')
        conn.on('open', function() {
          
          console.log('connection open')

          // TODO: onClose
          const buffer: Message[][] = [];
          let buffering = false;
          function sendNext() {
            setTimeout(() => {
              if (buffer.length) {
                  conn.send(buffer.shift());
                  sendNext();
              } else {
                  buffering = false;
              }
            }, 50); 
          }
          app.stop();
          //@ts-ignore (should update tracker dependency)
          app.addCommitCallback((messages: Array<Message>): void => {
            let i = 0;
            while (i < messages.length) {
              buffer.push(messages.slice(i, i+=1000));
            }
            if (!buffering) { 
              buffering = true;
              sendNext(); 
            }
          });
          app.start();
        });
      });
      let calling = false;
      peer.on('call', function(call) {
        const dataConn: DataConnection | undefined = peer
                .connections[call.peer].find(c => c.type === 'data');
        if (calling || !dataConn) {
          call.close();
          dataConn?.send("call_error");
          return;
        }
        calling = true;
        window.addEventListener("beforeunload", () => {
          dataConn.open && dataConn.send("call_end");
        });
        dataConn.on('data', (data) => { // if call closed be a caller before confirm
          if (data === "call_end") {
              calling = false;
              confirm.remove();
          }                    
        });
        const confirm = new Confirm(options.confirmText, options.confirmStyle);
        confirm.mount();
        confirm.onAnswer(conf => {
          if (!conf || !dataConn.open) {
            call.close();
            dataConn.open && dataConn.send("call_end");
            calling = false;
            return;
          }

          const mouse = new Mouse();
          let callUI;

          navigator.mediaDevices.getUserMedia({video:true, audio:true})
          .then(oStream => {
            const onClose = () => {
              console.log("close call...")
              if (call.open) { call.close(); }
              mouse.remove();
              callUI?.remove();
              oStream.getTracks().forEach(t => t.stop());

              calling = false;
              if (dataConn.open) {
                dataConn.send("call_end");
              }
            }
            dataConn.on("close", onClose);

            call.answer(oStream);
            call.on('close', onClose); // Works from time to time (peerjs bug)
            const intervalID = setInterval(() => {
              if (!call.open) {
                onClose();
                clearInterval(intervalID);
              }
            }, 5000);
            call.on('error', onClose); // notify about error?

            callUI = new CallWindow(onClose);
            callUI.setLocalStream(oStream);
            call.on('stream', function(iStream) {
              callUI.setRemoteStream(iStream);
              dataConn.on('data', (data: any) => {
                if (data === "call_end") {
                  onClose();
                  return;
                }
                if (call.open && data && typeof data.x === 'number' && typeof data.y === 'number') {
                  mouse.move(data);
                }
              });
            });
          });
        });
      });
    });
  }
}
