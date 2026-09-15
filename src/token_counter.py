from tokenizer import Tokenizer


tokenizer = Tokenizer()


samples = {
    "Short Question": (
        "What is the SLA for a P1 incident?"
    ),

    "Support Paragraph": (
        "For the ACME client, production incidents classified "
        "as P1 must be acknowledged within 15 minutes and "
        "escalated to the incident manager immediately. "
        "The support engineer should follow the production "
        "database outage runbook."
    ),

    "Client Runbook": (
        "ACME Production Database Incident Runbook. "
        "A P1 incident is a critical production outage. "
        "The support engineer must acknowledge the incident "
        "within 15 minutes, notify the incident manager, "
        "check database connectivity and application logs, "
        "follow the approved recovery procedure, and record "
        "all troubleshooting actions. If recovery fails, "
        "escalate the incident to the database engineering team."
    )
}


print("=" * 65)
print("RAG TOKEN ANALYSIS")
print("=" * 65)


total_tokens = 0


for name, text in samples.items():

    characters = len(text)
    tokens = tokenizer.count(text)

    total_tokens += tokens

    print(f"\n{name}")
    print("-" * 40)
    print(f"Characters : {characters}")
    print(f"Tokens     : {tokens}")
    print(f"Chars/token: {characters / tokens:.2f}")

INPUT_PRICE = 0.50
OUTPUT_PRICE = 3.00

output_tokens = 100

input_cost = (
    total_tokens / 1_000_000
) * INPUT_PRICE

output_cost = (
    output_tokens / 1_000_000
) * OUTPUT_PRICE

total_cost = input_cost + output_cost


print("\n" + "=" * 65)
print("COST ESTIMATE")
print("=" * 65)

print(f"Input tokens : {total_tokens}")
print(f"Output tokens: {output_tokens}")

print(f"Input cost   : ${input_cost:.8f}")
print(f"Output cost  : ${output_cost:.8f}")
print(f"Total cost   : ${total_cost:.8f}")


print("\n" + "=" * 65)
print("OBSERVATION")
print("=" * 65)

print(
    "Text length and token count generally increase together, "
    "but they are not exactly proportional because tokenizers "
    "split text into subword units."
)