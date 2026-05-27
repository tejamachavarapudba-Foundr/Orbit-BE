import {
  WebSocketGateway, WebSocketServer, SubscribeMessage,
  MessageBody, ConnectedSocket, OnGatewayConnection, OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { SocketService } from './socket.service';

@WebSocketGateway({ cors: { origin: '*' } })
export class SocketGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server!: Server;
  constructor(private svc: SocketService) {}

  handleConnection(client: Socket)    { this.svc.register(client); }
  handleDisconnect(client: Socket)    { this.svc.unregister(client); }

  @SubscribeMessage('chat:join')
  joinConversation(@MessageBody() conversationId: string, @ConnectedSocket() client: Socket) {
    client.join(`conv:${conversationId}`);
  }

  @SubscribeMessage('chat:send')
  send(@MessageBody() data: { conversationId: string; message: any }) {
    this.server.to(`conv:${data.conversationId}`).emit('chat:new', data.message);
  }
}
