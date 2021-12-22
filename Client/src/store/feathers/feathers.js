import { io } from "socket.io-client";
import feathers from '@feathersjs/client';
import { ref } from 'vue'

const socket = io('localhost:3030', {
  transports: ['websocket'],
  reconnectionAttempts: 2,
});
const client = feathers();
client.configure(feathers.socketio(socket));

const APIRefresh = ref(client.service('itinerary').get('paths', { query: { waitForUpdate: true, from: 'unknow', to: 'unknow' } }))

export {
  client,
  socket,
  APIRefresh,
}