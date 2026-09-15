import os
import logging

from dotenv import load_dotenv
# pyrefly: ignore [missing-import]
from openai import OpenAI, AuthenticationError, RateLimitError

load_dotenv()

api_key = os.getenv("GEMINI_API_KEY")
base_url = os.getenv("BASE_URL")
model = os.getenv("MODEL")

if not api_key:
    raise ValueError("GEMINI_API_KEY is missing from .env")

if not base_url:
    raise ValueError("BASE_URL is missing from .env")

if not model:
    raise ValueError("MODEL is missing from .env")

logging.basicConfig(
    level=logging.INFO,
    format="%(levelname)s: %(message)s"
)

client = OpenAI(
    api_key=api_key,
    base_url=base_url
)

system_prompt = (
    "You are an IT support assistant for an internal client "
    "documentation system. "
    "Your job is to help support teams find and understand "
    "client-specific onboarding procedures, SLAs, and runbooks. "
    "Be concise, factual, and precise. "
    "Never invent client-specific procedures, SLA values, "
    "or troubleshooting steps. "
    "Use only information provided in the conversation. "
    "If the provided information is insufficient, say: "
    "'I don't know based on the provided information.'"
)

prompts = [
    {
        "name": "Vague Prompt",
        "content": (
            "Tell me about the incident procedure."
        )
    },
    {
        "name": "Clear Prompt",
        "content": (
            "For the ACME client, identify the incident "
            "response procedure and summarize it in "
            "exactly three bullet points. "
            "If the ACME client procedure is not provided, "
            "say 'I don't know based on the provided information.'"
        )
    }
]


for prompt in prompts:

    print("\n" + "=" * 70)
    print(prompt["name"])
    print("=" * 70)

    messages = [
        {
            "role": "system",
            "content": system_prompt
        },
        {
            "role": "user",
            "content": prompt["content"]
        }
    ]

    try:

        logging.info("REQUEST: %s", messages)
        logging.info("MODEL: %s", model)

        response = client.chat.completions.create(
            model=model,
            messages=messages
        )
        answer = response.choices[0].message.content
        logging.info("RESPONSE: %s", answer)
        logging.info("USAGE: %s", response.usage)
        print("\nPrompt:")
        print(prompt["content"])

        print("\nAssistant:")
        print(answer)

    except AuthenticationError:
        print(
            "\nAuthentication failed (401). "
            "Check GEMINI_API_KEY in your .env file."
        )

    except RateLimitError:
        print(
            "\nRate limited (429). "
            "Check your Gemini API quota/rate limit "
            "and retry later."
        )

    except Exception as error:
        print(f"\nAPI request failed: {error}")