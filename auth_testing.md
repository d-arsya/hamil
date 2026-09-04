# Auth Testing Playbook (BidanKu)

## MongoDB Verification
```
mongosh
use test_database
db.users.find({role: "admin"}).pretty()
```
Verify: bcrypt hash starts with `$2b$`, unique index on users.username.

## API Testing
```
TOKEN=$(curl -s -X POST $REACT_APP_BACKEND_URL/api/auth/login -H "Content-Type: application/json" -d '{"username":"admin","password":"admin123"}' | python3 -c "import sys,json;print(json.load(sys.stdin)['token'])")
curl -s $REACT_APP_BACKEND_URL/api/auth/me -H "Authorization: Bearer $TOKEN"
```
Login returns {"token", "user"}. /me returns the user object.

## Credentials
- Username: admin / Password: admin123 (see /app/memory/test_credentials.md)
