"""Fictional candidate pool used by the mock people-search provider.

EVERY PROFILE BELOW IS FABRICATED for demonstration purposes. Names, employers,
phone numbers and links do not refer to real people. Phone numbers use the
reserved +91 99999 range so nothing can be dialled by accident.
"""

from __future__ import annotations

from typing import Any

MOCK_PROFILES: list[dict[str, Any]] = [
    {
        "id": "mock-0001",
        "full_name": "Aarav Mehta",
        "current_title": "Senior Full Stack Developer",
        "current_company": "Zenlane Technologies",
        "location": "Gurgaon, Delhi NCR",
        "country": "India",
        "experience_years": 4.5,
        "skills": ["React", "Node.js", "TypeScript", "MongoDB", "REST APIs", "AWS"],
        "summary": (
            "Full stack engineer building payment and onboarding flows for a B2B fintech. "
            "Owns the React design system and the Node services behind it."
        ),
        "education": [
            {"school": "Delhi Technological University", "degree": "B.Tech, CSE", "year": 2020}
        ],
        "experience": [
            {
                "title": "Senior Full Stack Developer",
                "company": "Zenlane Technologies",
                "start": "2022",
                "end": "Present",
            },
            {"title": "Software Engineer", "company": "Paytrail", "start": "2020", "end": "2022"},
        ],
        "availability_hint": "one_month",
    },
    {
        "id": "mock-0002",
        "full_name": "Ishita Rao",
        "current_title": "Frontend Engineer II",
        "current_company": "Northwind Labs",
        "location": "Bengaluru, Karnataka",
        "country": "India",
        "experience_years": 3.0,
        "skills": ["React", "TypeScript", "Next.js", "GraphQL", "Testing Library", "Tailwind CSS"],
        "summary": (
            "Frontend specialist focused on performance and accessibility. Cut first "
            "contentful paint by 40 percent across the core product."
        ),
        "education": [{"school": "RV College of Engineering", "degree": "B.E, ISE", "year": 2021}],
        "experience": [
            {
                "title": "Frontend Engineer II",
                "company": "Northwind Labs",
                "start": "2023",
                "end": "Present",
            },
            {"title": "Frontend Engineer", "company": "Cuemint", "start": "2021", "end": "2023"},
        ],
        "availability_hint": "two_months",
    },
    {
        "id": "mock-0003",
        "full_name": "Rohan Verma",
        "current_title": "Backend Engineer",
        "current_company": "Finlytics",
        "location": "Noida, Delhi NCR",
        "country": "India",
        "experience_years": 5.5,
        "skills": ["Node.js", "TypeScript", "PostgreSQL", "Redis", "Kafka", "Docker", "REST APIs"],
        "summary": (
            "Backend engineer running the ledger and reconciliation services for a "
            "lending platform processing 2M transactions a month."
        ),
        "education": [{"school": "NIT Kurukshetra", "degree": "B.Tech, IT", "year": 2019}],
        "experience": [
            {
                "title": "Backend Engineer",
                "company": "Finlytics",
                "start": "2021",
                "end": "Present",
            },
            {"title": "Software Engineer", "company": "Infoedge", "start": "2019", "end": "2021"},
        ],
        "availability_hint": "immediate",
    },
    {
        "id": "mock-0004",
        "full_name": "Priya Nair",
        "current_title": "Product Engineer",
        "current_company": "Craftly",
        "location": "Pune, Maharashtra",
        "country": "India",
        "experience_years": 2.5,
        "skills": ["React", "Node.js", "MongoDB", "Express", "REST APIs"],
        "summary": (
            "Generalist product engineer, ships end to end. Built the self-serve "
            "onboarding that lifted activation by 18 percent."
        ),
        "education": [{"school": "COEP Pune", "degree": "B.Tech, Computer", "year": 2022}],
        "experience": [
            {"title": "Product Engineer", "company": "Craftly", "start": "2022", "end": "Present"},
        ],
        "availability_hint": "one_month",
    },
    {
        "id": "mock-0005",
        "full_name": "Karthik Subramanian",
        "current_title": "Staff Software Engineer",
        "current_company": "Helios Systems",
        "location": "Chennai, Tamil Nadu",
        "country": "India",
        "experience_years": 8.0,
        "skills": [
            "System Design",
            "Go",
            "Kubernetes",
            "PostgreSQL",
            "AWS",
            "Node.js",
            "Terraform",
        ],
        "summary": (
            "Staff engineer leading platform architecture across three teams. Migrated "
            "a monolith to event-driven services with zero downtime."
        ),
        "education": [{"school": "IIT Madras", "degree": "B.Tech, CSE", "year": 2016}],
        "experience": [
            {
                "title": "Staff Software Engineer",
                "company": "Helios Systems",
                "start": "2021",
                "end": "Present",
            },
            {"title": "Senior Engineer", "company": "Freshworks", "start": "2018", "end": "2021"},
        ],
        "availability_hint": "three_months_plus",
    },
    {
        "id": "mock-0006",
        "full_name": "Ananya Sharma",
        "current_title": "Full Stack Developer",
        "current_company": "BrightPath EdTech",
        "location": "Delhi, Delhi NCR",
        "country": "India",
        "experience_years": 3.5,
        "skills": ["React", "Node.js", "TypeScript", "MongoDB", "REST APIs", "Jest"],
        "summary": (
            "Builds learner-facing products at scale, currently owning the assessment "
            "engine used by 400k students."
        ),
        "education": [{"school": "IGDTUW", "degree": "B.Tech, CSE", "year": 2021}],
        "experience": [
            {
                "title": "Full Stack Developer",
                "company": "BrightPath EdTech",
                "start": "2021",
                "end": "Present",
            },
        ],
        "availability_hint": "one_month",
    },
    {
        "id": "mock-0007",
        "full_name": "Vikram Desai",
        "current_title": "Engineering Manager",
        "current_company": "Orbit Commerce",
        "location": "Mumbai, Maharashtra",
        "country": "India",
        "experience_years": 9.5,
        "skills": ["System Design", "Node.js", "React", "Team Leadership", "AWS", "PostgreSQL"],
        "summary": (
            "Manages two product squads, still hands-on in architecture reviews. Scaled "
            "checkout to 12k orders per minute during peak sale events."
        ),
        "education": [{"school": "VJTI Mumbai", "degree": "B.Tech, CSE", "year": 2015}],
        "experience": [
            {
                "title": "Engineering Manager",
                "company": "Orbit Commerce",
                "start": "2022",
                "end": "Present",
            },
            {"title": "Tech Lead", "company": "Myntra", "start": "2019", "end": "2022"},
        ],
        "availability_hint": "not_looking",
    },
    {
        "id": "mock-0008",
        "full_name": "Sneha Iyer",
        "current_title": "Machine Learning Engineer",
        "current_company": "Vector Health",
        "location": "Bengaluru, Karnataka",
        "country": "India",
        "experience_years": 4.0,
        "skills": ["Python", "PyTorch", "LLMs", "FastAPI", "PostgreSQL", "MLOps"],
        "summary": (
            "Ships production ML for clinical document understanding. Built the RAG "
            "pipeline serving 60k queries a day."
        ),
        "education": [{"school": "IIIT Hyderabad", "degree": "M.Tech, CSE", "year": 2020}],
        "experience": [
            {"title": "ML Engineer", "company": "Vector Health", "start": "2021", "end": "Present"},
            {"title": "Data Scientist", "company": "Tredence", "start": "2020", "end": "2021"},
        ],
        "availability_hint": "two_months",
    },
    {
        "id": "mock-0009",
        "full_name": "Aditya Kulkarni",
        "current_title": "Software Engineer",
        "current_company": "Trailhead Analytics",
        "location": "Hyderabad, Telangana",
        "country": "India",
        "experience_years": 2.0,
        "skills": ["React", "JavaScript", "Node.js", "MySQL", "REST APIs"],
        "summary": "Early-career engineer with strong fundamentals, currently on the reporting team.",
        "education": [{"school": "BITS Pilani Hyderabad", "degree": "B.E, CSE", "year": 2023}],
        "experience": [
            {
                "title": "Software Engineer",
                "company": "Trailhead Analytics",
                "start": "2023",
                "end": "Present",
            },
        ],
        "availability_hint": "immediate",
    },
    {
        "id": "mock-0010",
        "full_name": "Meera Joshi",
        "current_title": "Senior Backend Engineer",
        "current_company": "Cobalt Cloud",
        "location": "Gurgaon, Delhi NCR",
        "country": "India",
        "experience_years": 6.0,
        "skills": ["Python", "FastAPI", "PostgreSQL", "Kubernetes", "System Design", "AWS"],
        "summary": (
            "Backend engineer on the multi-tenant control plane. Designed the tenant "
            "isolation model now used company-wide."
        ),
        "education": [{"school": "Thapar University", "degree": "B.E, CSE", "year": 2018}],
        "experience": [
            {
                "title": "Senior Backend Engineer",
                "company": "Cobalt Cloud",
                "start": "2021",
                "end": "Present",
            },
            {"title": "Backend Engineer", "company": "Zeta", "start": "2018", "end": "2021"},
        ],
        "availability_hint": "one_month",
    },
    {
        "id": "mock-0011",
        "full_name": "Farhan Qureshi",
        "current_title": "Full Stack Engineer",
        "current_company": "Loop Retail",
        "location": "Delhi, Delhi NCR",
        "country": "India",
        "experience_years": 3.2,
        "skills": ["React", "Node.js", "TypeScript", "MongoDB", "Docker", "REST APIs"],
        "summary": "Works across the stack on inventory and store-ops tooling for 300 retail outlets.",
        "education": [{"school": "Jamia Millia Islamia", "degree": "B.Tech, CSE", "year": 2021}],
        "experience": [
            {
                "title": "Full Stack Engineer",
                "company": "Loop Retail",
                "start": "2021",
                "end": "Present",
            },
        ],
        "availability_hint": "immediate",
    },
    {
        "id": "mock-0012",
        "full_name": "Divya Menon",
        "current_title": "Frontend Lead",
        "current_company": "Kite Interactive",
        "location": "Kochi, Kerala",
        "country": "India",
        "experience_years": 7.0,
        "skills": [
            "React",
            "TypeScript",
            "Next.js",
            "Design Systems",
            "Accessibility",
            "Tailwind CSS",
        ],
        "summary": "Leads a four-person frontend team and owns the shared component library.",
        "education": [{"school": "NIT Calicut", "degree": "B.Tech, CSE", "year": 2017}],
        "experience": [
            {
                "title": "Frontend Lead",
                "company": "Kite Interactive",
                "start": "2021",
                "end": "Present",
            },
            {
                "title": "Senior Frontend Engineer",
                "company": "Zoho",
                "start": "2017",
                "end": "2021",
            },
        ],
        "availability_hint": "two_months",
    },
    {
        "id": "mock-0013",
        "full_name": "Nikhil Bansal",
        "current_title": "DevOps Engineer",
        "current_company": "Stackforge",
        "location": "Noida, Delhi NCR",
        "country": "India",
        "experience_years": 5.0,
        "skills": ["AWS", "Terraform", "Kubernetes", "Docker", "CI/CD", "Python"],
        "summary": "Owns infrastructure for 40 microservices; cut cloud spend 32 percent in a year.",
        "education": [{"school": "Amity University", "degree": "B.Tech, IT", "year": 2019}],
        "experience": [
            {
                "title": "DevOps Engineer",
                "company": "Stackforge",
                "start": "2020",
                "end": "Present",
            },
        ],
        "availability_hint": "one_month",
    },
    {
        "id": "mock-0014",
        "full_name": "Tanvi Kapoor",
        "current_title": "Product Designer",
        "current_company": "Fable Studio",
        "location": "Bengaluru, Karnataka",
        "country": "India",
        "experience_years": 4.0,
        "skills": ["Figma", "Design Systems", "User Research", "Prototyping", "Accessibility"],
        "summary": "Designs B2B workflow products; ran the research programme behind a full redesign.",
        "education": [{"school": "NID Ahmedabad", "degree": "M.Des, Interaction", "year": 2021}],
        "experience": [
            {
                "title": "Product Designer",
                "company": "Fable Studio",
                "start": "2021",
                "end": "Present",
            },
        ],
        "availability_hint": "two_months",
    },
    {
        "id": "mock-0015",
        "full_name": "Siddharth Rana",
        "current_title": "Senior Full Stack Developer",
        "current_company": "Aeris Mobility",
        "location": "Gurgaon, Delhi NCR",
        "country": "India",
        "experience_years": 6.5,
        "skills": [
            "React",
            "Node.js",
            "TypeScript",
            "PostgreSQL",
            "System Design",
            "AWS",
            "REST APIs",
        ],
        "summary": (
            "Leads the driver-app platform team. Comfortable from database schema to "
            "React performance profiling."
        ),
        "education": [{"school": "DTU", "degree": "B.Tech, ECE", "year": 2018}],
        "experience": [
            {
                "title": "Senior Full Stack Developer",
                "company": "Aeris Mobility",
                "start": "2021",
                "end": "Present",
            },
            {"title": "Full Stack Developer", "company": "Ola", "start": "2018", "end": "2021"},
        ],
        "availability_hint": "one_month",
    },
    {
        "id": "mock-0016",
        "full_name": "Riya Chatterjee",
        "current_title": "Data Engineer",
        "current_company": "Meridian Data",
        "location": "Kolkata, West Bengal",
        "country": "India",
        "experience_years": 4.5,
        "skills": ["Python", "Airflow", "Spark", "PostgreSQL", "dbt", "AWS"],
        "summary": "Builds the analytics warehouse; owns 200+ dbt models and the ingestion layer.",
        "education": [{"school": "Jadavpur University", "degree": "B.E, CSE", "year": 2020}],
        "experience": [
            {
                "title": "Data Engineer",
                "company": "Meridian Data",
                "start": "2021",
                "end": "Present",
            },
        ],
        "availability_hint": "immediate",
    },
    {
        "id": "mock-0017",
        "full_name": "Arjun Pillai",
        "current_title": "Mobile Engineer",
        "current_company": "Nomad Health",
        "location": "Bengaluru, Karnataka",
        "country": "India",
        "experience_years": 5.0,
        "skills": ["React Native", "TypeScript", "iOS", "Android", "REST APIs"],
        "summary": "Ships a cross-platform app with 1.2M monthly actives.",
        "education": [{"school": "PES University", "degree": "B.Tech, CSE", "year": 2019}],
        "experience": [
            {
                "title": "Mobile Engineer",
                "company": "Nomad Health",
                "start": "2021",
                "end": "Present",
            },
        ],
        "availability_hint": "two_months",
    },
    {
        "id": "mock-0018",
        "full_name": "Neha Gupta",
        "current_title": "QA Automation Lead",
        "current_company": "Sentinel Software",
        "location": "Pune, Maharashtra",
        "country": "India",
        "experience_years": 7.5,
        "skills": ["Playwright", "TypeScript", "CI/CD", "API Testing", "Python"],
        "summary": "Built the regression suite that took release cycles from two weeks to two days.",
        "education": [{"school": "MIT Pune", "degree": "B.E, IT", "year": 2017}],
        "experience": [
            {
                "title": "QA Automation Lead",
                "company": "Sentinel Software",
                "start": "2022",
                "end": "Present",
            },
        ],
        "availability_hint": "one_month",
    },
    {
        "id": "mock-0019",
        "full_name": "Zoya Khan",
        "current_title": "Full Stack Developer",
        "current_company": "Petal Commerce",
        "location": "Delhi, Delhi NCR",
        "country": "India",
        "experience_years": 2.8,
        "skills": ["React", "Node.js", "MongoDB", "TypeScript", "REST APIs", "Redis"],
        "summary": "Owns the storefront and the order service behind it for a D2C brand.",
        "education": [{"school": "NSUT Delhi", "degree": "B.Tech, CSE", "year": 2022}],
        "experience": [
            {
                "title": "Full Stack Developer",
                "company": "Petal Commerce",
                "start": "2022",
                "end": "Present",
            },
        ],
        "availability_hint": "immediate",
    },
    {
        "id": "mock-0020",
        "full_name": "Harsh Patel",
        "current_title": "Solutions Architect",
        "current_company": "Vantage Cloud",
        "location": "Ahmedabad, Gujarat",
        "country": "India",
        "experience_years": 10.0,
        "skills": ["System Design", "AWS", "Kubernetes", "Node.js", "PostgreSQL", "Microservices"],
        "summary": "Designs enterprise migrations; ten years across payments and logistics.",
        "education": [{"school": "Nirma University", "degree": "B.Tech, CSE", "year": 2014}],
        "experience": [
            {
                "title": "Solutions Architect",
                "company": "Vantage Cloud",
                "start": "2020",
                "end": "Present",
            },
        ],
        "availability_hint": "three_months_plus",
    },
    {
        "id": "mock-0021",
        "full_name": "Lakshmi Prasad",
        "current_title": "Senior Product Manager",
        "current_company": "Corely",
        "location": "Hyderabad, Telangana",
        "country": "India",
        "experience_years": 8.5,
        "skills": ["Product Strategy", "Analytics", "SQL", "User Research", "Roadmapping"],
        "summary": "Runs the growth pod; took activation from 22 to 39 percent in four quarters.",
        "education": [{"school": "ISB Hyderabad", "degree": "MBA", "year": 2018}],
        "experience": [
            {
                "title": "Senior Product Manager",
                "company": "Corely",
                "start": "2021",
                "end": "Present",
            },
        ],
        "availability_hint": "not_looking",
    },
    {
        "id": "mock-0022",
        "full_name": "Imran Sheikh",
        "current_title": "Backend Developer",
        "current_company": "Quanta Logistics",
        "location": "Gurgaon, Delhi NCR",
        "country": "India",
        "experience_years": 3.8,
        "skills": ["Node.js", "TypeScript", "MongoDB", "REST APIs", "Docker", "RabbitMQ"],
        "summary": "Builds route-optimisation services handling 90k shipments a day.",
        "education": [
            {"school": "Aligarh Muslim University", "degree": "B.Tech, CSE", "year": 2021}
        ],
        "experience": [
            {
                "title": "Backend Developer",
                "company": "Quanta Logistics",
                "start": "2021",
                "end": "Present",
            },
        ],
        "availability_hint": "one_month",
    },
    {
        "id": "mock-0023",
        "full_name": "Sara Thomas",
        "current_title": "Engineering Lead, Platform",
        "current_company": "Wavelength",
        "location": "Remote, India",
        "country": "India",
        "experience_years": 9.0,
        "skills": ["System Design", "Python", "FastAPI", "PostgreSQL", "AWS", "Team Leadership"],
        "summary": "Remote-first platform lead; built the internal developer platform from scratch.",
        "education": [{"school": "CUSAT", "degree": "B.Tech, CSE", "year": 2015}],
        "experience": [
            {
                "title": "Engineering Lead",
                "company": "Wavelength",
                "start": "2020",
                "end": "Present",
            },
        ],
        "availability_hint": "two_months",
    },
    {
        "id": "mock-0024",
        "full_name": "Devansh Agarwal",
        "current_title": "Full Stack Engineer",
        "current_company": "Ledgerly",
        "location": "Jaipur, Rajasthan",
        "country": "India",
        "experience_years": 4.2,
        "skills": ["React", "Node.js", "TypeScript", "PostgreSQL", "REST APIs", "GraphQL"],
        "summary": "Accounting-automation product; owns the integrations layer across 14 partners.",
        "education": [{"school": "MNIT Jaipur", "degree": "B.Tech, CSE", "year": 2020}],
        "experience": [
            {
                "title": "Full Stack Engineer",
                "company": "Ledgerly",
                "start": "2020",
                "end": "Present",
            },
        ],
        "availability_hint": "immediate",
    },
]
