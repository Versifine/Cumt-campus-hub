package store

import (
	"fmt"
	"strings"
	"time"
)

func (s *Store) Register(account, password, nickname string) (RegisterResult, error) {
	normalizedAccount := normalizeEmail(account)
	trimmedPassword := strings.TrimSpace(password)
	trimmedNickname := strings.TrimSpace(nickname)
	if normalizedAccount == "" || trimmedPassword == "" || trimmedNickname == "" {
		return RegisterResult{}, ErrInvalidInput
	}
	if !validateEmail(normalizedAccount) {
		return RegisterResult{}, ErrInvalidEmail
	}
	if !validatePassword(trimmedPassword) {
		return RegisterResult{}, ErrWeakPassword
	}
	if !validateNickname(trimmedNickname) {
		return RegisterResult{}, ErrInvalidNickname
	}

	passwordHash, err := hashPassword(trimmedPassword)
	if err != nil {
		return RegisterResult{}, err
	}

	verificationToken, err := newVerificationToken()
	if err != nil {
		return RegisterResult{}, err
	}
	verificationHash := hashVerificationToken(verificationToken)
	verificationExpiry := verificationTokenExpiry()

	s.mu.Lock()
	defer s.mu.Unlock()

	userID, ok := s.accounts[normalizedAccount]
	if ok {
		verification := s.accountVerification[normalizedAccount]
		if verification.VerifiedAt != "" {
			return RegisterResult{}, ErrAccountExists
		}
		s.passwords[normalizedAccount] = passwordHash
		user := s.users[userID]
		user.Nickname = trimmedNickname
		s.users[userID] = user
	} else {
		s.nextUserID++
		userID = fmt.Sprintf("u_%d", s.nextUserID)
		user := User{
			ID:        userID,
			Nickname:  trimmedNickname,
			Exp:       0,
			CreatedAt: now(),
		}
		s.users[userID] = user
		s.accounts[normalizedAccount] = userID
		s.passwords[normalizedAccount] = passwordHash
	}

	s.accountVerification[normalizedAccount] = AccountVerification{
		VerifiedAt: "",
		TokenHash:  verificationHash,
		ExpiresAt:  verificationExpiry,
	}

	return RegisterResult{
		User:              s.users[userID],
		VerificationToken: verificationToken,
	}, nil
}

func (s *Store) Login(account, password string) (string, User, error) {
	normalizedAccount := normalizeEmail(account)
	trimmedPassword := strings.TrimSpace(password)
	if normalizedAccount == "" || trimmedPassword == "" {
		return "", User{}, ErrInvalidInput
	}

	s.mu.Lock()
	userID, ok := s.accounts[normalizedAccount]
	if !ok {
		s.mu.Unlock()
		return "", User{}, ErrInvalidCredentials
	}
	passwordHash := s.passwords[normalizedAccount]
	user := s.users[userID]
	verification, hasVerification := s.accountVerification[normalizedAccount]
	s.mu.Unlock()

	if !verifyPassword(passwordHash, trimmedPassword) {
		return "", User{}, ErrInvalidCredentials
	}
	if hasVerification && verification.VerifiedAt == "" {
		return "", User{}, ErrAccountUnverified
	}

	token, err := newToken()
	if err != nil {
		return "", User{}, err
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	if old := s.userTokens[userID]; old != "" {
		delete(s.tokens, old)
	}
	s.tokens[token] = userID
	s.userTokens[userID] = token

	return token, user, nil
}

func (s *Store) VerifyEmail(token string) error {
	trimmedToken := strings.TrimSpace(token)
	if trimmedToken == "" {
		return ErrInvalidInput
	}
	verificationHash := hashVerificationToken(trimmedToken)

	s.mu.Lock()
	defer s.mu.Unlock()

	nowTime := time.Now().UTC()
	for account, verification := range s.accountVerification {
		if verification.TokenHash != verificationHash {
			continue
		}
		if verification.VerifiedAt != "" {
			return nil
		}
		if verification.ExpiresAt.IsZero() {
			return ErrVerificationTokenInvalid
		}
		if nowTime.After(verification.ExpiresAt) {
			return ErrVerificationTokenExpired
		}
		verification.VerifiedAt = now()
		s.accountVerification[account] = verification
		return nil
	}
	return ErrVerificationTokenInvalid
}

func (s *Store) ResendVerification(account string) (string, error) {
	normalizedAccount := normalizeEmail(account)
	if normalizedAccount == "" {
		return "", ErrInvalidInput
	}
	if !validateEmail(normalizedAccount) {
		return "", ErrInvalidEmail
	}

	verificationToken, err := newVerificationToken()
	if err != nil {
		return "", err
	}
	verificationHash := hashVerificationToken(verificationToken)
	verificationExpiry := verificationTokenExpiry()

	s.mu.Lock()
	defer s.mu.Unlock()

	if _, ok := s.accounts[normalizedAccount]; !ok {
		return "", ErrNotFound
	}
	verification := s.accountVerification[normalizedAccount]
	if verification.VerifiedAt != "" {
		return "", ErrAccountVerified
	}
	verification.TokenHash = verificationHash
	verification.ExpiresAt = verificationExpiry
	s.accountVerification[normalizedAccount] = verification
	return verificationToken, nil
}

func (s *Store) DeactivateAccount(userID string) error {
	trimmedID := strings.TrimSpace(userID)
	if trimmedID == "" {
		return ErrInvalidInput
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	user, ok := s.users[trimmedID]
	if !ok {
		return ErrNotFound
	}

	accountKey := ""
	for account, id := range s.accounts {
		if id == trimmedID {
			accountKey = account
			break
		}
	}
	if accountKey != "" {
		delete(s.accounts, accountKey)
		delete(s.passwords, accountKey)
		delete(s.accountVerification, accountKey)
	}
	if token := s.userTokens[trimmedID]; token != "" {
		delete(s.tokens, token)
	}
	delete(s.userTokens, trimmedID)

	user.Nickname = "已注销用户"
	user.Avatar = ""
	user.Cover = ""
	user.Bio = ""
	s.users[trimmedID] = user

	for followerID, followees := range s.follows {
		if followerID == trimmedID {
			delete(s.follows, followerID)
			continue
		}
		delete(followees, trimmedID)
	}

	return nil
}
