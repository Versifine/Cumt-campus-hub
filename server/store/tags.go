package store

func encodeTags(tags []string) string {
	return encodeAttachmentIDs(tags)
}

func decodeTags(raw string) []string {
	return decodeAttachmentIDs(raw)
}
