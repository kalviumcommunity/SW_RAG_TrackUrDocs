from .db import Base, engine, SessionLocal
from .models import User, Collection, ExpectedDocument
from .auth import hash_password

Base.metadata.create_all(bind=engine)
db=SessionLocal()
try:
    if not db.query(User).filter(User.email=="admin@trackurdocs.local").first():
        db.add(User(name="Admin",email="admin@trackurdocs.local",
                    password_hash=hash_password("Admin@12345"),role="Admin"))
    if not db.query(Collection).count():
        db.add_all([
            Collection(name="HR Policies",description="HR policies and employee guidance."),
            Collection(name="Engineering",description="Architecture and engineering guidance."),
            Collection(name="Security",description="Security policies and controls."),
            Collection(name="Finance",description="Finance and reimbursement documents."),
            Collection(name="Legal",description="Legal policies and agreements."),
        ])
    if not db.query(ExpectedDocument).count():
        db.add_all([
            ExpectedDocument(name="Business Continuity Plan",category="Operations",priority="High"),
            ExpectedDocument(name="Updated Security Policy",category="Security",priority="High"),
            ExpectedDocument(name="Q3 Engineering Guidelines",category="Engineering",priority="Medium"),
        ])
    db.commit()
finally:
    db.close()
print("Seed complete.")
print("Demo login: admin@trackurdocs.local / Admin@12345")
