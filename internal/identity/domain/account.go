package domain

type SelfProfileUpdate struct {
	Name      *string
	AvatarURL *string
}

type SelfIdentityUpdate struct {
	NationalIDSet bool
	NationalID    *string
	PhoneSet      bool
	Phone         *string
}
