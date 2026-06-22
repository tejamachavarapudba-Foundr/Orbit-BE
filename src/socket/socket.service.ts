import { Injectable, Logger } from '@nestjs/common';
import { Socket } from 'socket.io';

@Injectable()
export class SocketService {
  private log = new Logger('Socket');
  register(client: Socket)   { this.log.log(`+ ${client.id}`); }
  unregister(client: Socket) { this.log.log(`- ${client.id}`); }
}
