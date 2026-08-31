package db

type Item struct {
	ID                 string          `json:"id"`
	Type               string          `json:"type"` // url, note, image, document, video
	Title              string          `json:"title"`
	Description        string          `json:"description"`
	SourceURL          *string         `json:"sourceUrl"`
	CanonicalURL       *string         `json:"canonicalUrl"`
	SourceDomain       *string         `json:"sourceDomain"`
	ContentText        string          `json:"contentText"`
	OrganizationStatus string          `json:"organizationStatus"` // inbox, organized, archived
	ProcessingStatus   string          `json:"processingStatus"`   // pending, processing, ready, failed
	Favorite           bool            `json:"favorite"`
	CapturedAt         *int64          `json:"capturedAt"`
	CreatedAt          int64           `json:"createdAt"`
	UpdatedAt          int64           `json:"updatedAt"`
	Tags               []Tag           `json:"tags,omitempty"`
	Assets             []Asset         `json:"assets,omitempty"`
	Logs               []IngestionLog  `json:"logs,omitempty"`
}

type Tag struct {
	ID        string `json:"id"`
	Name      string `json:"name"`
	Color     string `json:"color"`
	CreatedAt int64  `json:"createdAt"`
	ItemCount int    `json:"itemCount,omitempty"`
}

type ItemTag struct {
	ItemID    string `json:"itemId"`
	TagID     string `json:"tagId"`
	CreatedAt int64  `json:"createdAt"`
}

type Asset struct {
	ID          string `json:"id"`
	ItemID      string `json:"itemId"`
	Kind        string `json:"kind"` // screenshot, markdown, original, thumbnail, pdf
	MimeType    string `json:"mimeType"`
	FileName    string `json:"fileName"`
	FileSize    int64  `json:"fileSize"`
	StoragePath string `json:"storagePath"`
	SHA256      string `json:"sha256"`
	CreatedAt   int64  `json:"createdAt"`
}

type IngestionLog struct {
	ID        string `json:"id"`
	ItemID    string `json:"itemId"`
	Step      string `json:"step"`
	Status    string `json:"status"` // pending, running, success, failed
	Message   string `json:"message"`
	CreatedAt int64  `json:"createdAt"`
}
