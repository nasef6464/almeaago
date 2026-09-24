package google

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/nasef6464/almeaago/internal/identity/domain"
)

const (
	defaultAuthURL     = "https://accounts.google.com/o/oauth2/v2/auth"
	defaultTokenURL    = "https://oauth2.googleapis.com/token"
	defaultUserInfoURL = "https://www.googleapis.com/oauth2/v3/userinfo"
)

type Config struct {
	ClientID     string
	ClientSecret string
	RedirectURI  string
	AuthURL      string
	TokenURL     string
	UserInfoURL  string
}

type Client struct {
	config Config
	http   *http.Client
}

func New(config Config) *Client {
	if strings.TrimSpace(config.AuthURL) == "" {
		config.AuthURL = defaultAuthURL
	}
	if strings.TrimSpace(config.TokenURL) == "" {
		config.TokenURL = defaultTokenURL
	}
	if strings.TrimSpace(config.UserInfoURL) == "" {
		config.UserInfoURL = defaultUserInfoURL
	}
	return &Client{
		config: config,
		http:   &http.Client{Timeout: 8 * time.Second},
	}
}

func (c *Client) Available() bool {
	return strings.TrimSpace(c.config.ClientID) != "" &&
		strings.TrimSpace(c.config.ClientSecret) != "" &&
		strings.TrimSpace(c.config.RedirectURI) != ""
}

func (c *Client) AuthorizationURL(state string) string {
	values := url.Values{}
	values.Set("client_id", c.config.ClientID)
	values.Set("redirect_uri", c.config.RedirectURI)
	values.Set("response_type", "code")
	values.Set("scope", "openid email profile")
	values.Set("state", state)
	values.Set("access_type", "online")
	values.Set("prompt", "select_account")
	return c.config.AuthURL + "?" + values.Encode()
}

func (c *Client) Exchange(ctx context.Context, code string) (domain.GoogleProfile, error) {
	if !c.Available() {
		return domain.GoogleProfile{}, fmt.Errorf("google oauth is not configured")
	}

	form := url.Values{}
	form.Set("code", code)
	form.Set("client_id", c.config.ClientID)
	form.Set("client_secret", c.config.ClientSecret)
	form.Set("redirect_uri", c.config.RedirectURI)
	form.Set("grant_type", "authorization_code")

	request, err := http.NewRequestWithContext(
		ctx,
		http.MethodPost,
		c.config.TokenURL,
		strings.NewReader(form.Encode()),
	)
	if err != nil {
		return domain.GoogleProfile{}, err
	}
	request.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	response, err := c.http.Do(request)
	if err != nil {
		return domain.GoogleProfile{}, fmt.Errorf("google token exchange: %w", err)
	}
	defer response.Body.Close()

	if response.StatusCode < 200 || response.StatusCode >= 300 {
		return domain.GoogleProfile{}, fmt.Errorf("google token exchange returned %d", response.StatusCode)
	}

	var tokenBody struct {
		AccessToken string `json:"access_token"`
	}
	if err := json.NewDecoder(response.Body).Decode(&tokenBody); err != nil {
		return domain.GoogleProfile{}, fmt.Errorf("decode google token: %w", err)
	}
	if strings.TrimSpace(tokenBody.AccessToken) == "" {
		return domain.GoogleProfile{}, fmt.Errorf("google access token missing")
	}

	profileRequest, err := http.NewRequestWithContext(ctx, http.MethodGet, c.config.UserInfoURL, nil)
	if err != nil {
		return domain.GoogleProfile{}, err
	}
	profileRequest.Header.Set("Authorization", "Bearer "+tokenBody.AccessToken)

	profileResponse, err := c.http.Do(profileRequest)
	if err != nil {
		return domain.GoogleProfile{}, fmt.Errorf("google profile fetch: %w", err)
	}
	defer profileResponse.Body.Close()

	if profileResponse.StatusCode < 200 || profileResponse.StatusCode >= 300 {
		return domain.GoogleProfile{}, fmt.Errorf("google profile returned %d", profileResponse.StatusCode)
	}

	var body struct {
		Subject       string `json:"sub"`
		Email         string `json:"email"`
		Name          string `json:"name"`
		Picture       string `json:"picture"`
		EmailVerified bool   `json:"email_verified"`
	}
	if err := json.NewDecoder(profileResponse.Body).Decode(&body); err != nil {
		return domain.GoogleProfile{}, fmt.Errorf("decode google profile: %w", err)
	}

	return domain.GoogleProfile{
		Subject:       body.Subject,
		Email:         body.Email,
		Name:          body.Name,
		AvatarURL:     body.Picture,
		EmailVerified: body.EmailVerified,
	}, nil
}
