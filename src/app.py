import os
import logging

from dotenv import load_dotenv
# pyrefly: ignore [missing-import]
from openai import OpenAI, AuthenticationError, RateLimitError

from tokenizer import Tokenizer


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
tokenizer = Tokenizer()
SYSTEM_PROMPT = (
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

CONTEXT_BUDGET = 6000

history = [
    {
        "role": "system",
        "content": SYSTEM_PROMPT
    }
]

def total_tokens(messages):
    """
    Count the total text tokens currently present
    in the conversation history.
    """

    return sum(
        tokenizer.count(message["content"])
        for message in messages
    )

def trim_history(messages, budget=CONTEXT_BUDGET):
    """
    Remove the oldest conversation turns until the
    history fits inside the configured token budget.

    The system message is always preserved.
    """

    removed_messages = 0

    while total_tokens(messages) > budget and len(messages) > 2:

        messages.pop(1)

        removed_messages += 1

    return removed_messages

def ask(user_message):
    """
    Add a user message, measure the history, trim if
    necessary, send it to Gemini, and store the response.
    """

    history.append(
        {
            "role": "user",
            "content": user_message
        }
    )

    before_trim = total_tokens(history)

    logging.info(
        "History tokens before trimming: %s",
        before_trim
    )

    removed_messages = trim_history(history)

    after_trim = total_tokens(history)

    logging.info(
        "History tokens after trimming: %s",
        after_trim
    )

    logging.info(
        "Messages removed: %s",
        removed_messages
    )

    try:

        logging.info("MODEL: %s", model)
        logging.info("REQUEST TOKENS: %s", after_trim)

        response = client.chat.completions.create(
            model=model,
            messages=history
        )

        answer = response.choices[0].message.content

        history.append(
            {
                "role": "assistant",
                "content": answer
            }
        )

        output_tokens = tokenizer.count(answer)
        final_history_tokens = total_tokens(history)

        logging.info(
            "OUTPUT TOKENS: %s",
            output_tokens
        )

        logging.info(
            "HISTORY TOKENS AFTER RESPONSE: %s",
            final_history_tokens
        )

        return answer

    except AuthenticationError:
        history.pop()

        return (
            "Authentication failed (401). "
            "Check GEMINI_API_KEY in your .env file."
        )

    except RateLimitError:
        history.pop()

        return (
            "Rate limited (429). "
            "Check your Gemini API quota/rate limit "
            "and retry later."
        )

    except Exception as error:
        history.pop()

        return f"API request failed: {error}"

questions = [
    "What documents are maintained for each client account?",

    "For the ACME client, what information should I check "
    "before starting an incident investigation?",

    "What is the SLA for a P1 incident for ACME?",

    "Who should be notified when the ACME production service "
    "has a critical outage?",

    "Which runbook should the support engineer follow for "
    "an ACME production database outage?",

    "What should be recorded during troubleshooting?",

    "When should the incident be escalated to the database "
    "engineering team?",

    "What happens if the normal recovery procedure fails?"
]


for turn_number, question in enumerate(questions, start=1):

    print("\n" + "=" * 70)
    print(f"TURN {turn_number}")
    print("=" * 70)

    print("\nUser:")
    print(question)

    answer = ask(question)

    print("\nAssistant:")
    print(answer)

    print("\nCurrent History Tokens:")
    print(total_tokens(history))

    print(f"Context Budget: {CONTEXT_BUDGET}")