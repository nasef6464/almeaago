package main

import (
	"bufio"
	"context"
	"fmt"
	"os"
	"strings"

	"github.com/jackc/pgx/v5/pgxpool"
)

func main() {
	var dbURL string
	f, err := os.Open(".env")
	if err == nil {
		scanner := bufio.NewScanner(f)
		for scanner.Scan() {
			line := strings.TrimSpace(scanner.Text())
			if strings.HasPrefix(line, "DATABASE_URL=") {
				dbURL = strings.Trim(strings.TrimPrefix(line, "DATABASE_URL="), "\"")
				break
			}
		}
		f.Close()
	}
	ctx := context.Background()
	pool, err := pgxpool.New(ctx, dbURL)
	if err != nil {
		fmt.Printf("Error: %v\n", err)
		return
	}
	defer pool.Close()

	pHash := "$argon2id$v=19$m=19456,t=2,p=1$dVri3IURKM/YqpdYhwTXKg$8rjKkM1QfbL5KbMJLFQ32LUGS66qXGTQ+FHUN53V0lk"

	// 1. Upsert Coach user by ID
	coachID := "018f0000-0000-7000-8000-000000000007"
	_, err = pool.Exec(ctx, `
		INSERT INTO users (id, email, name, password_hash, status)
		VALUES ($1, 'coach@almeaa.com', 'أ. طارق المحمدي - مدرب المنصة', $2, 'active')
		ON CONFLICT (id) DO UPDATE
		SET email = 'coach@almeaa.com', password_hash = $2, status = 'active', name = 'أ. طارق المحمدي - مدرب المنصة';
	`, coachID, pHash)
	if err != nil {
		fmt.Printf("Error upserting coach: %v\n", err)
	} else {
		fmt.Println("Coach user upserted successfully.")
	}

	// Roles for Coach
	roles := []string{"platform_trainer", "trainer", "teacher"}
	for _, r := range roles {
		pool.Exec(ctx, `
			INSERT INTO user_roles (user_id, role)
			VALUES ($1, $2)
			ON CONFLICT DO NOTHING;
		`, coachID, r)
	}
	fmt.Println("Coach roles configured.")

	// 2. Ensure Parent user by ID
	parentID := "018f0000-0000-7000-8000-000000000006"
	_, err = pool.Exec(ctx, `
		INSERT INTO users (id, email, name, password_hash, status)
		VALUES ($1, 'parent@almeaa.com', 'سعد بن ناصر - ولي أمر', $2, 'active')
		ON CONFLICT (id) DO UPDATE
		SET email = 'parent@almeaa.com', password_hash = $2, status = 'active', name = 'سعد بن ناصر - ولي أمر';
	`, parentID, pHash)
	if err != nil {
		fmt.Printf("Error upserting parent: %v\n", err)
	} else {
		fmt.Println("Parent user upserted successfully.")
	}

	pool.Exec(ctx, `
		INSERT INTO user_roles (user_id, role)
		VALUES ($1, 'parent')
		ON CONFLICT DO NOTHING;
	`, parentID)

	// 3. Ensure parent_student_relationship with student 018f0000-0000-7000-8000-000000000005
	studentID := "018f0000-0000-7000-8000-000000000005"
	pool.Exec(ctx, `
		INSERT INTO parent_student_relationships (parent_user_id, student_user_id, status, source)
		SELECT $1, $2, 'active', 'invitation'
		WHERE NOT EXISTS (
			SELECT 1 FROM parent_student_relationships WHERE parent_user_id = $1 AND student_user_id = $2
		);
	`, parentID, studentID)
	fmt.Println("Parent-Student relationship verified.")
}
