package security

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"strconv"
	"strings"
	"time"
)

type Claims struct {
	Subject  string   `json:"sub"`
	Name     string   `json:"name"`
	Issuer   string   `json:"iss"`
	Roles    []string `json:"roles"`
	Entities []string `json:"entities"`
	Sites    []string `json:"sites"`
	IssuedAt int64    `json:"iat"`
	Expires  int64    `json:"exp"`
}

type TokenService struct {
	secret []byte
	issuer string
	ttl    time.Duration
}

func NewTokenService(secret, issuer string, ttl time.Duration) TokenService {
	return TokenService{secret: []byte(secret), issuer: issuer, ttl: ttl}
}

func (s TokenService) Issue(subject, name string, roles, entities, sites []string) (string, Claims, error) {
	now := time.Now().UTC()
	claims := Claims{
		Subject: subject, Name: name, Issuer: s.issuer,
		Roles: roles, Entities: entities, Sites: sites,
		IssuedAt: now.Unix(), Expires: now.Add(s.ttl).Unix(),
	}
	header := map[string]string{"alg": "HS256", "typ": "JWT"}
	headerJSON, err := json.Marshal(header)
	if err != nil {
		return "", Claims{}, err
	}
	claimsJSON, err := json.Marshal(claims)
	if err != nil {
		return "", Claims{}, err
	}
	unsigned := encode(headerJSON) + "." + encode(claimsJSON)
	signature := s.sign(unsigned)
	return unsigned + "." + signature, claims, nil
}

func (s TokenService) Parse(token string) (Claims, error) {
	parts := strings.Split(token, ".")
	if len(parts) != 3 {
		return Claims{}, errors.New("invalid token format")
	}
	unsigned := parts[0] + "." + parts[1]
	expected := s.sign(unsigned)
	if !hmac.Equal([]byte(expected), []byte(parts[2])) {
		return Claims{}, errors.New("invalid token signature")
	}
	payload, err := base64.RawURLEncoding.DecodeString(parts[1])
	if err != nil {
		return Claims{}, errors.New("invalid token payload")
	}
	var claims Claims
	if err := json.Unmarshal(payload, &claims); err != nil {
		return Claims{}, errors.New("invalid token claims")
	}
	if claims.Issuer != s.issuer {
		return Claims{}, errors.New("invalid token issuer")
	}
	if claims.Expires <= time.Now().UTC().Unix() {
		return Claims{}, errors.New("token expired")
	}
	if claims.Subject == "" {
		return Claims{}, errors.New("token subject missing")
	}
	return claims, nil
}

func (s TokenService) sign(value string) string {
	mac := hmac.New(sha256.New, s.secret)
	_, _ = mac.Write([]byte(value))
	return base64.RawURLEncoding.EncodeToString(mac.Sum(nil))
}

func encode(value []byte) string { return base64.RawURLEncoding.EncodeToString(value) }

func Bearer(value string) (string, error) {
	if value == "" {
		return "", errors.New("authorization header missing")
	}
	parts := strings.Fields(value)
	if len(parts) != 2 || !strings.EqualFold(parts[0], "Bearer") {
		return "", errors.New("bearer token required")
	}
	return parts[1], nil
}

func Has(values []string, wanted string) bool {
	for _, value := range values {
		if strings.EqualFold(value, wanted) {
			return true
		}
	}
	return false
}

func TokenTTLSeconds(claims Claims) string {
	remaining := claims.Expires - time.Now().UTC().Unix()
	if remaining < 0 {
		remaining = 0
	}
	return strconv.FormatInt(remaining, 10)
}

func ScopeError(kind, value string) error {
	return fmt.Errorf("%s scope %q is not authorized for this session", kind, value)
}
