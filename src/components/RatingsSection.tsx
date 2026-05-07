import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Star, Loader2, CheckCircle2, MessageSquare } from 'lucide-react';

/**
 * Public ratings & reviews section.
 *
 * - Shows the overall average + count of APPROVED ratings only.
 * - Lists approved ratings (Person Name, star rating, comment).
 * - Has an inline submission form that creates a row with status='pending';
 *   admin must approve it before it appears publicly.
 *
 * Designed to be dropped into the marketing Home page below the services grid.
 */

interface Rating {
  id: string;
  person_name: string;
  rating: number;
  comment: string | null;
  status: string;
  created_at: string;
}

const StarRow: React.FC<{ value: number; size?: number; onSelect?: (n: number) => void; interactive?: boolean }> = ({
  value, size = 18, onSelect, interactive,
}) => (
  <div className="inline-flex items-center gap-0.5">
    {[1, 2, 3, 4, 5].map((n) => (
      <button
        key={n}
        type="button"
        disabled={!interactive}
        onClick={() => interactive && onSelect?.(n)}
        className={`${interactive ? 'cursor-pointer hover:scale-110 transition' : 'cursor-default'} p-0.5`}
        aria-label={`${n} star${n > 1 ? 's' : ''}`}
      >
        <Star
          width={size}
          height={size}
          className={n <= value ? 'fill-[#D4AF37] text-[#D4AF37]' : 'text-[#C0C0C0]'}
        />
      </button>
    ))}
  </div>
);

const RatingsSection: React.FC = () => {
  const [ratings, setRatings] = useState<Rating[]>([]);
  const [loading, setLoading] = useState(true);

  // Submission form state
  const [name, setName] = useState('');
  const [score, setScore] = useState(5);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('ratings')
      .select('*')
      .eq('status', 'approved')
      .order('created_at', { ascending: false });
    setRatings((data as Rating[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!name.trim()) { setError('Please enter your name.'); return; }
    if (score < 1 || score > 5) { setError('Please choose a star rating.'); return; }
    setSubmitting(true);
    const { error: err } = await supabase.from('ratings').insert({
      person_name: name.trim(),
      rating: score,
      comment: comment.trim() || null,
      status: 'pending',
    });
    setSubmitting(false);
    if (err) {
      setError('Unable to submit your rating right now. Please try again.');
      return;
    }
    setSubmitted(true);
    setName('');
    setScore(5);
    setComment('');
  };

  const total = ratings.length;
  const average = total ? ratings.reduce((s, r) => s + (r.rating || 0), 0) / total : 0;

  return (
    <section className="bg-[#FAF6EC] border-y border-[#C9A961]/20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center mb-10">
          <p className="text-[#D4AF37] text-sm font-semibold tracking-widest uppercase mb-3">Client Reviews</p>
          <h2 className="text-4xl md:text-5xl font-bold text-black mb-4">What Our Clients Say</h2>
          <p className="text-lg text-black/60 max-w-2xl mx-auto">
            Honest feedback from agencies we've supported.
          </p>
        </div>

        {/* Aggregate */}
        <div className="bg-white rounded-2xl border border-[#C0C0C0]/40 p-6 md:p-8 mb-10 grid md:grid-cols-[auto_1fr] gap-6 items-center">
          <div className="text-center md:text-left">
            <div className="text-5xl font-bold text-black mb-1">{average.toFixed(1)}</div>
            <StarRow value={Math.round(average)} size={22} />
            <div className="text-sm text-black/60 mt-1">
              Based on {total} approved review{total === 1 ? '' : 's'}
            </div>
          </div>
          <div className="text-sm text-black/60 md:border-l md:border-[#C0C0C0]/40 md:pl-6">
            Ratings are reviewed by Resolve360 before being published. Your honest feedback helps other
            agencies discover whether we're the right partner for their needs.
          </div>
        </div>

        <div className="grid lg:grid-cols-[1.4fr_1fr] gap-8">
          {/* Reviews list */}
          <div>
            <h3 className="text-xl font-semibold text-black mb-4 flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-[#D4AF37]" />
              Approved Reviews
            </h3>
            {loading ? (
              <div className="flex items-center gap-2 text-black/60 text-sm">
                <Loader2 className="w-4 h-4 animate-spin" /> Loading reviews...
              </div>
            ) : ratings.length === 0 ? (
              <div className="bg-white rounded-2xl border border-dashed border-[#C0C0C0]/60 p-8 text-center text-black/60 text-sm">
                No approved reviews yet. Be the first to share your experience.
              </div>
            ) : (
              <div className="space-y-4">
                {ratings.map((r) => (
                  <div key={r.id} className="bg-white rounded-2xl border border-[#C0C0C0]/40 p-5">
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div>
                        <p className="font-semibold text-black">{r.person_name}</p>
                        <StarRow value={r.rating} />
                      </div>
                      <span className="text-xs text-black/50 whitespace-nowrap">
                        {new Date(r.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    {r.comment && <p className="text-sm text-black/70 leading-relaxed">{r.comment}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Submission form */}
          <div>
            <h3 className="text-xl font-semibold text-black mb-4">Leave a Review</h3>
            {submitted ? (
              <div className="bg-white rounded-2xl border border-green-200 p-6 text-center">
                <CheckCircle2 className="w-10 h-10 text-green-600 mx-auto mb-2" />
                <p className="font-semibold text-black mb-1">Thank you.</p>
                <p className="text-sm text-black/60 mb-4">
                  Your rating has been submitted for review.
                </p>
                <button
                  onClick={() => setSubmitted(false)}
                  className="text-sm font-semibold text-[#A8871F] hover:text-[#D4AF37]"
                >
                  Submit another review
                </button>
              </div>
            ) : (
              <form onSubmit={submit} className="bg-white rounded-2xl border border-[#C0C0C0]/40 p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-black mb-1.5">Your Name *</label>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    className="w-full px-4 py-2.5 rounded-lg border border-[#C0C0C0]/60 bg-white focus:outline-none focus:border-[#D4AF37]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-black mb-1.5">Your Rating *</label>
                  <StarRow value={score} size={28} interactive onSelect={setScore} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-black mb-1.5">Comment</label>
                  <textarea
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    rows={4}
                    placeholder="Tell us about your experience working with Resolve360..."
                    className="w-full px-4 py-2.5 rounded-lg border border-[#C0C0C0]/60 bg-white focus:outline-none focus:border-[#D4AF37] text-sm"
                  />
                </div>
                {error && <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>}
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg bg-[#D4AF37] text-black font-semibold hover:bg-[#B8961F] disabled:opacity-50"
                >
                  {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  {submitting ? 'Submitting...' : 'Submit Review'}
                </button>
                <p className="text-xs text-black/50 text-center">
                  Reviews are moderated and may take up to 1–2 business days to appear.
                </p>
              </form>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};

export default RatingsSection;
