import { io } from "socket.io-client";
import feathers from '@feathersjs/client';

const socket = io('localhost:3030', {
  transports: ['websocket'],
  reconnectionAttempts: 2,
});
const client = feathers();
client.configure(feathers.socketio(socket));

const APIRefresh = {}

APIRefresh.result = new Promise((resolve, reject) => {
  APIRefresh.resolve = resolve
  APIRefresh.reject = reject
})

client.service('itinerary').get('paths', { query: { waitForUpdate: true, from: 'unknow', to: 'unknow' } }).then((r) => {
  if (r.code && r.code == 200) {
    APIRefresh.resolve(r)
  }
  else APIRefresh.reject(r)
}).catch(() => {
  APIRefresh.reject(r)
})

export {
  client,
  socket,
  APIRefresh,
}