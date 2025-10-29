// Predefined color palettes for avatars
const avatarColors = [
  { bg: '#3B82F6', text: '#FFFFFF' }, // Blue
  { bg: '#10B981', text: '#FFFFFF' }, // Green
  { bg: '#F59E0B', text: '#FFFFFF' }, // Yellow
  { bg: '#EF4444', text: '#FFFFFF' }, // Red
  { bg: '#8B5CF6', text: '#FFFFFF' }, // Purple
  { bg: '#06B6D4', text: '#FFFFFF' }, // Cyan
  { bg: '#F97316', text: '#FFFFFF' }, // Orange
  { bg: '#EC4899', text: '#FFFFFF' }, // Pink
  { bg: '#84CC16', text: '#FFFFFF' }, // Lime
  { bg: '#6366F1', text: '#FFFFFF' }, // Indigo
  { bg: '#14B8A6', text: '#FFFFFF' }, // Teal
  { bg: '#F43F5E', text: '#FFFFFF' }, // Rose
];

/**
 * Generate a consistent color for a user based on their identifier
 * @param identifier - User ID, username, or any string identifier
 * @returns Object with background and text colors
 */
export function getAvatarColor(identifier: string): { bg: string; text: string } {
  if (!identifier) {
    return avatarColors[0]; // Default color
  }
  
  // Create a simple hash from the identifier
  let hash = 0;
  for (let i = 0; i < identifier.length; i++) {
    const char = identifier.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  
  // Use the absolute value and modulo to get a consistent index
  const index = Math.abs(hash) % avatarColors.length;
  return avatarColors[index];
}

/**
 * Get initials from a user's name
 * @param firstName - User's first name
 * @param lastName - User's last name
 * @returns String of initials (e.g., "JW" for "John Wick")
 */
export function getInitials(firstName?: string, lastName?: string): string {
  const first = firstName?.trim().charAt(0).toUpperCase() || '';
  const last = lastName?.trim().charAt(0).toUpperCase() || '';
  return first + last || '?';
} 