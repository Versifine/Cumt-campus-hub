package chat

import "sync"

type Hub struct {
	mu    sync.Mutex
	rooms map[string]map[*Client]bool
}

func NewHub() *Hub {
	return &Hub{
		rooms: map[string]map[*Client]bool{},
	}
}

func (h *Hub) Join(room string, client *Client) {
	h.mu.Lock()
	defer h.mu.Unlock()

	if h.rooms[room] == nil {
		h.rooms[room] = map[*Client]bool{}
	}
	h.rooms[room][client] = true
	client.Room = room
}

func (h *Hub) Leave(client *Client) {
	h.mu.Lock()
	defer h.mu.Unlock()

	room := client.Room
	if room == "" {
		return
	}
	clients := h.rooms[room]
	if clients == nil {
		return
	}
	delete(clients, client)
	if len(clients) == 0 {
		delete(h.rooms, room)
	}
	client.Room = ""
}

func (h *Hub) Broadcast(room string, message []byte) {
	h.mu.Lock()
	clients := h.rooms[room]
	h.mu.Unlock()

	for client := range clients {
		select {
		case client.Send <- message:
		default:
		}
	}
}
