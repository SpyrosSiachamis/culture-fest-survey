import enum

class AudienceType(str, enum.Enum):
    STUDENT = "student"
    TOURIST = "tourist"
    LOCAL = "local"

class Gender(str, enum.Enum):
    MALE = "male"
    FEMALE = "female"
    OTHER = "other"

class AccountType(str, enum.Enum):
    ADMIN = "admin"
    USER = "user"