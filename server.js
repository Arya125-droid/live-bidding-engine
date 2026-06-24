import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocketServer, WebSocket } from 'ws';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3000;

let currentHighestBid = 100;

const server = http.createServer((req, res)=>{
    if(req.method==='GET' && req.url==='/'){
        const filePath = path.join(__dirname, 'index.html');
        const fileStream = fs.createReadStream(filePath);

        res.writeHead(200, {'Content-Type':'text/html'});

        // Moving the file to browser
        fileStream.pipe(res)

        fileStream.on('error',()=>{
            res.writeHead(500);
            res.end('error loading index.html');
        });
    }

    else if(req.method==='POST' && req.url==='/bid'){
        let body = '';

        // Gather data chunks as they arrive
        req.on('data',chunk =>{
            body+=chunk.toString();
        });

        req.on('end', ()=>{
            try{
                const data = JSON.parse(body);
                const newBid = Number(data.amount);

                // check the new bid
                if(newBid>currentHighestBid){
                    currentHighestBid = newBid;
                    console.log(`New highest bid accepted: ${currentHighestBid}`);
                    res.writeHead(200, {'Content-Type':'application/json'});
                    res.end(JSON.stringify({success:true, message:'Bid Accepted!'}));

                    // use websocket and broadcast this bid to all
                    broadcastNewBid();
                } else{
                    res.writeHead(400, {'Content-Type':'application/json'});
                    res.end(JSON.stringify({success:false, message:'Bid Rejected!'}));
                }
            } catch(error){
                res.writeHead(400);
                res.end('Invalid JSON payload');
            }
        });
    }

    else{
        res.writeHead(404);
        res.end('Not Found');
    }
});

const wss = new WebSocketServer({server});
wss.on('connection', (ws)=>{
    console.log(`New user joined the auction. (${wss.clients.size} total)`);
    
    // the exact millisecond someone joins push the cache size on their screen
    ws.send(JSON.stringify({type: 'UPDATE_BID', amount:currentHighestBid}));

    ws.on('close', ()=>{
        console.log(`User left the auction. (${wss.clients.size} total)`);
    });
});

function broadcastNewBid(){
    const message = JSON.stringify({type: 'UPDATE_BID', amount: currentHighestBid});

    wss.clients.forEach((client)=>{
        if(client.readyState===WebSocket.OPEN){
            client.send(message);
        }
    });
}

server.listen(PORT, ()=>{
    console.log(`Server running on http://localhost:${PORT}`);
});