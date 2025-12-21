package store

import (
	"encoding/json"
	"strings"
)

func encodeAttachmentIDs(ids []string) string {
	if len(ids) == 0 {
		return ""
	}
	trimmed := make([]string, 0, len(ids))
	for _, id := range ids {
		value := strings.TrimSpace(id)
		if value == "" {
			continue
		}
		trimmed = append(trimmed, value)
	}
	if len(trimmed) == 0 {
		return ""
	}
	raw, err := json.Marshal(trimmed)
	if err != nil {
		return ""
	}
	return string(raw)
}

func decodeAttachmentIDs(raw string) []string {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" {
		return nil
	}
	var ids []string
	if err := json.Unmarshal([]byte(trimmed), &ids); err != nil {
		return nil
	}
	out := make([]string, 0, len(ids))
	for _, id := range ids {
		value := strings.TrimSpace(id)
		if value == "" {
			continue
		}
		out = append(out, value)
	}
	return out
}
