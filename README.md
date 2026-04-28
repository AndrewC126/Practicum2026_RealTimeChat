# Practicum2026_RealTimeChat
This is my semester project for my Spring 2026 CS Practicum.  This project will be a Real-time online chat app.
## Logical Data Design
```mermaid
erDiagram

    USERS {
        uuid        id              PK
        varchar     username
        varchar     email
        varchar     password_hash
        timestamp   created_at
        timestamp   last_seen_at
    }

    ROOMS {
        uuid        id              PK
        uuid        owner_id        FK
        varchar     name
        varchar     description
        boolean     is_private
        timestamp   created_at
    }

    ROOM_MEMBERS {
        uuid        id              PK
        uuid        room_id         FK
        uuid        user_id         FK
        timestamp   joined_at
        integer     unread_count
    }

    MESSAGES {
        uuid        id              PK
        uuid        room_id         FK
        uuid        sender_id       FK
        text        body
        boolean     is_system_message
        timestamp   created_at
    }

    CONTACTS {
        uuid        id              PK
        uuid        user_id         FK
        uuid        application_id  FK
        varchar     name
        varchar     email
        varchar     phone
        varchar     linkedin_url
        timestamp   created_at
    }

    SESSIONS {
        uuid        id              PK
        uuid        user_id         FK
        varchar     socket_id
        boolean     is_online
        timestamp   connected_at
        timestamp   disconnected_at
    }

    USERS ||--o{ ROOMS           : "owns"
    USERS ||--o{ ROOM_MEMBERS    : "has"
    USERS ||--o{ MESSAGES        : "sends"
    USERS ||--o{ SESSIONS        : "has"
    USERS ||--o{ CONTACTS        : "has"

    ROOMS ||--o{ ROOM_MEMBERS    : "has"
    ROOMS ||--o{ MESSAGES        : "contains"

    ROOM_MEMBERS }o--|| USERS    : "references"
    ROOM_MEMBERS }o--|| ROOMS    : "references"

    MESSAGES }o--|| USERS        : "sent by"
    MESSAGES }o--|| ROOMS        : "belongs to"

    SESSIONS }o--|| USERS        : "belongs to"

    CONTACTS }o--|| USERS        : "belongs to"
