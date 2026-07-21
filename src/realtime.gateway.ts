import { 
  WebSocketGateway, 
  WebSocketServer, 
  SubscribeMessage, 
  MessageBody, 
  ConnectedSocket 
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

// Enable CORS so your mobile APK can securely connect to this socket
@WebSocketGateway({
  cors: {
    origin: '*', 
  },
})
export class RealtimeGateway {
  @WebSocketServer()
  server: Server;

  // Runs automatically whenever a mobile device connects
  handleConnection(client: Socket) {
    console.log(`Mobile client connected: ${client.id}`);
  }

  // Runs automatically when a mobile device disconnects
  handleDisconnect(client: Socket) {
    console.log(`Mobile client disconnected: ${client.id}`);
  }

  // Listening for a specific event sent from the mobile app (e.g., 'sendMessage')
  @SubscribeMessage('sendMessage')
  handleMessage(@MessageBody() data: any, @ConnectedSocket() client: Socket) {
    console.log('Data received from mobile:', data);

    // Broadcast the real-time data back to all connected users
    this.server.emit('receiveMessage', {
      sender: client.id,
      message: data.message,
      timestamp: new Date(),
    });
  }
}
