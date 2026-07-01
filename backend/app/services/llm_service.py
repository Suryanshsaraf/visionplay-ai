import os
from google import genai
from google.genai import types
from sqlalchemy.orm import Session
from app.services.rag_service import search_match_events

def generate_rag_response(match_id: int, query: str) -> str:
    # 1. Retrieve relevant timeline events from ChromaDB vector database
    print(f"Retrieving vector context for match {match_id} query: '{query}'...")
    context_events = search_match_events(match_id, query, n_results=4)

    context_str = ""
    if context_events:
        context_str = "Timeline Event Logs:\n" + "\n".join([
            f"- {ev['document']}" for ev in context_events
        ])
    else:
        context_str = "No specific event matches found in the computer vision logs."

    # 2. Check if GEMINI_API_KEY is configured
    api_key = os.environ.get("GEMINI_API_KEY")
    
    if not api_key:
        print("GEMINI_API_KEY not found in environment. Using rule-based offline fallback responder.")
        return generate_offline_fallback_response(query, context_events)

    # 3. Call Gemini API using the official google-genai SDK
    try:
        # Create client with specified key
        client = genai.Client(api_key=api_key)
        
        system_instruction = (
            "You are VisionPlay AI, an expert sports intelligence assistant. "
            "You are analyzing computer vision event logs for a football match. "
            "Your job is to answer user queries using ONLY the provided timeline events. "
            "Follow these rules strictly:\n"
            "1. Be concise, professional, and clear.\n"
            "2. Always cite the exact timestamp (e.g., [42.69s]) when mentioning events.\n"
            "3. If the context does not contain relevant information, state that you cannot find it in the match data.\n"
            "4. Do not make up any events or statistics that are not present in the logs."
        )

        prompt = f"User Query: {query}\n\n{context_str}"

        print(f"Sending prompt to Gemini API...")
        response = client.models.generate_content(
            model='gemini-2.5-flash',
            contents=prompt,
            config=types.GenerateContentConfig(
                system_instruction=system_instruction,
                temperature=0.2
            )
        )
        return response.text.strip()

    except Exception as e:
        print(f"Gemini API execution failed ({str(e)}). Falling back to offline responder.")
        return generate_offline_fallback_response(query, context_events) + f"\n\n*(Gemini API Error: {str(e)})*"

def generate_offline_fallback_response(query: str, context_events: list) -> str:
    if not context_events:
        return (
            "I searched the match timeline logs but couldn't find any relevant computer vision events "
            "matching your query. Could you please rephrase or ask about specific events like passes, shots, or goals?"
        )
        
    response = (
        "Here are the matching timeline events I retrieved from the computer vision logs:\n\n"
    )
    for ev in context_events:
        response += f"- **{ev['document']}**\n"
        
    response += (
        "\n*(VisionPlay AI is currently running in offline fallback mode. "
        "To enable full natural language explanations, please configure a valid GEMINI_API_KEY in your backend .env file.)*"
    )
    return response
