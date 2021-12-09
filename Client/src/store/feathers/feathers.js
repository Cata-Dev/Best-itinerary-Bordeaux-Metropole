import { io } from "socket.io-client";
import feathers from '@feathersjs/client';

const socket = io('localhost:3030', {
  transports: ['websocket'],
});
const client = feathers();
client.configure(feathers.socketio(socket));

export default client