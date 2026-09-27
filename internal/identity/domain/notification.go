package domain

type NotificationRecipient struct {
	ID    string
	Name  string
	Email string
	Phone string
	Roles []Role
}
