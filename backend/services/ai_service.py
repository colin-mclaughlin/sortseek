import os
import logging
from typing import Optional
import openai
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

logger = logging.getLogger(__name__)

class AIService:
    """Service for AI-powered features like summarization and suggestions"""
    
    def __init__(self):
        self.client = None
        self.is_available = False
        self._initialize_openai()
    
    def _initialize_openai(self):
        """Initialize OpenAI client"""
        try:
            api_key = os.getenv("OPENAI_API_KEY")
            if api_key:
                openai.api_key = api_key
                self.client = openai
                self.is_available = True
                logger.info("OpenAI client initialized successfully")
            else:
                logger.warning("OpenAI API key not found. AI features will be disabled.")
                self.is_available = False
        except Exception as e:
            logger.error(f"Failed to initialize OpenAI client: {e}")
            self.is_available = False
    
    def is_available(self) -> bool:
        """Check if AI service is available"""
        return self.is_available and self.client is not None
    
    async def summarize_text(self, text: str, max_length: int = 200) -> str:
        """Summarize text using OpenAI GPT-4"""
        if not self.is_available():
            return self._fallback_summarize(text, max_length)
        
        try:
            # Truncate text if too long for API
            if len(text) > 4000:
                text = text[:4000] + "..."
            
            response = await self.client.ChatCompletion.acreate(
                model="gpt-4o-mini",
                messages=[
                    {
                        "role": "system",
                        "content": f"You are a helpful assistant that creates concise summaries. Create a summary of no more than {max_length} characters."
                    },
                    {
                        "role": "user",
                        "content": f"Please summarize the following text:\n\n{text}"
                    }
                ],
                max_tokens=150,
                temperature=0.3
            )
            
            summary = response.choices[0].message.content.strip()
            return summary
            
        except Exception as e:
            logger.error(f"OpenAI summarization failed: {e}")
            return self._fallback_summarize(text, max_length)
    
    def _fallback_summarize(self, text: str, max_length: int) -> str:
        """Fallback summarization when AI is not available"""
        try:
            # Simple extractive summarization
            sentences = text.split('.')
            if len(sentences) <= 2:
                return text[:max_length] + "..." if len(text) > max_length else text
            
            # Take first few sentences
            summary = '. '.join(sentences[:2]) + '.'
            if len(summary) > max_length:
                summary = summary[:max_length-3] + "..."
            
            return summary
            
        except Exception as e:
            logger.error(f"Fallback summarization failed: {e}")
            return text[:max_length] + "..." if len(text) > max_length else text
    
    async def suggest_filename(self, content: str, current_name: Optional[str] = None) -> str:
        """Suggest a filename based on document content"""
        if not self.is_available():
            return self._fallback_filename(content, current_name)
        
        try:
            # Truncate content if too long
            if len(content) > 2000:
                content = content[:2000] + "..."
            
            prompt = f"Based on the following document content, suggest a clear and descriptive filename (without extension):\n\n{content}"
            if current_name:
                prompt += f"\n\nCurrent filename: {current_name}"
            
            response = await self.client.ChatCompletion.acreate(
                model="gpt-4o-mini",
                messages=[
                    {
                        "role": "system",
                        "content": "You are a helpful assistant that suggests descriptive filenames. Return only the filename without extension, keeping it under 50 characters."
                    },
                    {
                        "role": "user",
                        "content": prompt
                    }
                ],
                max_tokens=50,
                temperature=0.3
            )
            
            suggestion = response.choices[0].message.content.strip()
            # Clean up the suggestion
            suggestion = suggestion.replace('"', '').replace("'", "")
            if len(suggestion) > 50:
                suggestion = suggestion[:47] + "..."
            
            return suggestion
            
        except Exception as e:
            logger.error(f"OpenAI filename suggestion failed: {e}")
            return self._fallback_filename(content, current_name)
    
    def _fallback_filename(self, content: str, current_name: Optional[str] = None) -> str:
        """Fallback filename suggestion"""
        try:
            # Extract first meaningful line
            lines = content.split('\n')
            for line in lines:
                line = line.strip()
                if line and len(line) > 5 and len(line) < 50:
                    # Clean up the line
                    clean_line = ''.join(c for c in line if c.isalnum() or c in ' -_')
                    if clean_line:
                        return clean_line[:50]
            
            # Fallback to current name or default
            if current_name:
                return current_name.rsplit('.', 1)[0]  # Remove extension
            return "document"
            
        except Exception as e:
            logger.error(f"Fallback filename suggestion failed: {e}")
            return "document"
    
    async def suggest_folder(self, content: str, current_path: Optional[str] = None) -> str:
        """Suggest a folder location based on document content"""
        if not self.is_available():
            return self._fallback_folder(content, current_path)
        
        try:
            # Truncate content if too long
            if len(content) > 2000:
                content = content[:2000] + "..."
            
            prompt = f"Based on the following document content, suggest an appropriate folder name for organizing this document:\n\n{content}"
            if current_path:
                prompt += f"\n\nCurrent location: {current_path}"
            
            response = await self.client.ChatCompletion.acreate(
                model="gpt-4o-mini",
                messages=[
                    {
                        "role": "system",
                        "content": "You are a helpful assistant that suggests folder names for document organization. Return only the folder name, keeping it under 30 characters. Use common folder names like 'Work', 'Personal', 'Projects', 'Documents', etc."
                    },
                    {
                        "role": "user",
                        "content": prompt
                    }
                ],
                max_tokens=30,
                temperature=0.3
            )
            
            suggestion = response.choices[0].message.content.strip()
            # Clean up the suggestion
            suggestion = suggestion.replace('"', '').replace("'", "")
            if len(suggestion) > 30:
                suggestion = suggestion[:27] + "..."
            
            return suggestion
            
        except Exception as e:
            logger.error(f"OpenAI folder suggestion failed: {e}")
            return self._fallback_folder(content, current_path)
    
    def _fallback_folder(self, content: str, current_path: Optional[str] = None) -> str:
        """Fallback folder suggestion"""
        try:
            # Simple keyword-based folder suggestion
            content_lower = content.lower()
            
            # Define keyword mappings
            folder_keywords = {
                'work': ['work', 'business', 'office', 'professional', 'job', 'career'],
                'personal': ['personal', 'family', 'home', 'private'],
                'projects': ['project', 'development', 'code', 'software', 'app'],
                'documents': ['document', 'report', 'paper', 'article'],
                'finance': ['finance', 'money', 'budget', 'expense', 'financial'],
                'health': ['health', 'medical', 'doctor', 'hospital', 'medicine'],
                'education': ['education', 'school', 'study', 'learning', 'course']
            }
            
            # Find matching keywords
            for folder, keywords in folder_keywords.items():
                if any(keyword in content_lower for keyword in keywords):
                    return folder.capitalize()
            
            # Default folder
            return "Documents"
            
        except Exception as e:
            logger.error(f"Fallback folder suggestion failed: {e}")
            return "Documents"
    
    async def answer_question(self, question: str, context: str) -> str:
        """Answer a question based on document context"""
        if not self.is_available():
            return "AI service is not available. Please check your OpenAI API key configuration."
        
        try:
            # Truncate context if too long
            if len(context) > 3000:
                context = context[:3000] + "..."
            
            response = await self.client.ChatCompletion.acreate(
                model="gpt-4o-mini",
                messages=[
                    {
                        "role": "system",
                        "content": "You are a helpful assistant that answers questions based on the provided document context. If the answer cannot be found in the context, say so."
                    },
                    {
                        "role": "user",
                        "content": f"Context:\n{context}\n\nQuestion: {question}"
                    }
                ],
                max_tokens=200,
                temperature=0.3
            )
            
            answer = response.choices[0].message.content.strip()
            return answer
            
        except Exception as e:
            logger.error(f"OpenAI question answering failed: {e}")
            return "Sorry, I couldn't process your question at the moment." 