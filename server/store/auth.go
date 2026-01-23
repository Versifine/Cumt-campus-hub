package store

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"net/mail"
	"strings"
	"time"
	"unicode"
	"unicode/utf8"

	"golang.org/x/crypto/bcrypt"
)

var (
	ErrInvalidInput             = errors.New("invalid input")
	ErrInvalidCredentials       = errors.New("invalid credentials")
	ErrAccountExists            = errors.New("account already exists")
	ErrInvalidEmail             = errors.New("invalid email")
	ErrInvalidNickname          = errors.New("invalid nickname")
	ErrWeakPassword             = errors.New("weak password")
	ErrAccountUnverified        = errors.New("account not verified")
	ErrAccountVerified          = errors.New("account already verified")
	ErrVerificationTokenInvalid = errors.New("invalid verification token")
	ErrVerificationTokenExpired = errors.New("verification token expired")
	ErrNotFound                 = errors.New("not found")
	ErrForbidden                = errors.New("forbidden")
)

const (
	minPasswordLength    = 8
	maxNicknameLength    = 32
	verificationTokenTTL = 24 * time.Hour
)

func hashPassword(password string) (string, error) {
	hashed, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return "", err
	}
	return string(hashed), nil
}

func verifyPassword(passwordHash string, password string) bool {
	if passwordHash == "" || password == "" {
		return false
	}
	return bcrypt.CompareHashAndPassword([]byte(passwordHash), []byte(password)) == nil
}

func normalizeEmail(email string) string {
	return strings.ToLower(strings.TrimSpace(email))
}

func validateEmail(email string) bool {
	trimmed := strings.TrimSpace(email)
	if trimmed == "" {
		return false
	}
	addr, err := mail.ParseAddress(trimmed)
	if err != nil {
		return false
	}
	return addr.Address == trimmed
}

func validatePassword(password string) bool {
	if password == "" {
		return false
	}
	if strings.TrimSpace(password) != password {
		return false
	}
	if len(password) < minPasswordLength {
		return false
	}
	containsLetter := false
	containsDigit := false
	for _, r := range password {
		if unicode.IsLetter(r) {
			containsLetter = true
		} else if unicode.IsDigit(r) {
			containsDigit = true
		}
	}
	return containsLetter && containsDigit
}

func validateNickname(nickname string) bool {
	trimmed := strings.TrimSpace(nickname)
	if trimmed == "" {
		return false
	}
	if utf8.RuneCountInString(trimmed) > maxNicknameLength {
		return false
	}
	return true
}

func newToken() (string, error) {
	var b [32]byte
	if _, err := rand.Read(b[:]); err != nil {
		return "", err
	}
	return "t_" + hex.EncodeToString(b[:]), nil
}

func newVerificationToken() (string, error) {
	var b [32]byte
	if _, err := rand.Read(b[:]); err != nil {
		return "", err
	}
	return "v_" + hex.EncodeToString(b[:]), nil
}

func hashVerificationToken(token string) string {
	hash := sha256.Sum256([]byte(token))
	return hex.EncodeToString(hash[:])
}

func verificationTokenExpiry() time.Time {
	return time.Now().UTC().Add(verificationTokenTTL)
}
