import os
import logging
import time

from dotenv import load_dotenv
# pyrefly: ignore [missing-import]
from openai import OpenAI, AuthenticationError, RateLimitError

load_dotenv()

api_key = os.getenv("GEMINI_API_KEY")
base_url = os.getenv("BASE_URL")
model = os.getenv("MODEL")

if not api_key:
    raise ValueError(
        "GEMINI_API_KEY is missing. "
        "Add it to your .env file."
    )

if not base_url:
    raise ValueError(
        "BASE_URL is missing. "
        "Add it to your .env file."
    )

if not model:
    raise ValueError(
        "MODEL is missing. "
        "Add it to your .env file."
    )

logging.basicConfig(
    level=logging.INFO,
    format="%(levelname)s: %(message)s"
)
client = OpenAI(
    api_key=api_key,
    base_url=base_url
)
messages = [
    {
        "role": "system",
        "content": "You are a concise assistant."
    },
    {
        "role": "user",
        "content": "Say hello in one sentence."
    }
]

MAX_RETRIES = 3

for attempt in range(MAX_RETRIES):

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

        print("\nAssistant:")
        print(answer)

        break

    except AuthenticationError:

        print(
            "\nAuthentication failed (401).\n"
            "Check your GEMINI_API_KEY in the .env file."
        )

        break

    except RateLimitError:

        if attempt < MAX_RETRIES - 1:

            wait_time = 2 ** attempt

            print(
                f"\nRate limited (429). "
                f"Retrying in {wait_time} seconds..."
            )

            time.sleep(wait_time)

        else:

            print(
                "\nRate limit still active after "
                f"{MAX_RETRIES} attempts."
            )

    except Exception as error:

        print(
            f"\nAPI request failed:\n{error}"
        )

        break