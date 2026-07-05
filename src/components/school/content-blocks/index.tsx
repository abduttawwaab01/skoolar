'use client';

import { SchoolProfile } from '@/lib/school-cache';
import { parseExtraSections, parseFeatureCards } from '@/lib/school-utils';
import {
  GraduationCap, Users, BookOpen, Award,
  Heart, Star, Globe, Lightbulb, Rocket, Shield, Target, Zap,
  ArrowRight, Minus,
} from 'lucide-react';

const ICON_MAP: Record<string, React.ElementType> = {
  GraduationCap, Users, BookOpen, Award,
  Heart, Star, Globe, Lightbulb, Rocket, Shield, Target, Zap,
};

function FeatureCardsSection({ school }: { school: SchoolProfile }) {
  const cards = parseFeatureCards(school.featureCards);
  if (cards.length === 0) return null;

  return (
    <section className="py-20 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {cards.slice(0, 4).map((card, i) => {
            const Icon = ICON_MAP[card.icon] || Star;
            return (
              <div key={i} className="text-center p-6 bg-white rounded-xl shadow-sm">
                <div
                  className="w-12 h-12 rounded-lg flex items-center justify-center mx-auto mb-4"
                  style={{ backgroundColor: 'var(--school-primary-light)', color: 'var(--school-primary)' }}
                >
                  <Icon className="h-6 w-6" />
                </div>
                <h3 className="font-semibold text-gray-900">{card.title}</h3>
                <p className="text-sm text-gray-600 mt-1">{card.description}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function renderContentBlock(block: any, index: number) {
  let content: Record<string, string> = {};
  try { content = JSON.parse(block.content); } catch { content = { text: block.content }; }

  switch (block.type) {
    case 'text':
      return (
        <section key={block.id || index} className="py-16">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            {content.heading && <h2 className="text-3xl font-bold text-center mb-6">{content.heading}</h2>}
            {content.text && <div className="prose prose-lg max-w-4xl mx-auto text-gray-600"><p>{content.text}</p></div>}
          </div>
        </section>
      );

    case 'image':
      return (
        <section key={block.id || index} className="py-16 bg-gray-50">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            {content.imageUrl && (
              <img src={content.imageUrl} alt={content.caption || ''} className="rounded-xl max-h-96 w-full object-cover" />
            )}
            {content.caption && <p className="text-sm text-gray-500 mt-3">{content.caption}</p>}
          </div>
        </section>
      );

    case 'text-image': {
      const side = content.side || 'left';
      return (
        <section key={block.id || index} className="py-16">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className={`grid grid-cols-1 md:grid-cols-2 gap-12 items-center ${side === 'right' ? '' : ''}`}>
              {side === 'left' ? (
                <>
                  <div>
                    {content.heading && <h2 className="text-3xl font-bold mb-4">{content.heading}</h2>}
                    {content.text && <p className="text-gray-600">{content.text}</p>}
                  </div>
                  {content.imageUrl && <img src={content.imageUrl} alt="" className="rounded-xl w-full object-cover max-h-96" />}
                </>
              ) : (
                <>
                  {content.imageUrl && <img src={content.imageUrl} alt="" className="rounded-xl w-full object-cover max-h-96" />}
                  <div>
                    {content.heading && <h2 className="text-3xl font-bold mb-4">{content.heading}</h2>}
                    {content.text && <p className="text-gray-600">{content.text}</p>}
                  </div>
                </>
              )}
            </div>
          </div>
        </section>
      );
    }

    case 'cta':
      return (
        <section key={block.id || index} className="py-20" style={{ backgroundColor: 'var(--school-primary)' }}>
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            {content.heading && <h2 className="text-3xl font-bold text-white mb-4">{content.heading}</h2>}
            {content.description && <p className="text-white/80 mb-8">{content.description}</p>}
            {content.buttonText && (
              <a
                href={content.buttonUrl || '#'}
                className="inline-flex items-center gap-2 px-8 py-3 rounded-lg bg-white font-semibold hover:bg-gray-100 transition-colors"
                style={{ color: 'var(--school-primary)' }}
              >
                {content.buttonText} <ArrowRight className="h-5 w-5" />
              </a>
            )}
          </div>
        </section>
      );

    case 'divider':
      return (
        <section key={block.id || index} className="py-8">
          <div className="max-w-4xl mx-auto px-4">
            <Minus className="h-6 w-full text-gray-300" />
          </div>
        </section>
      );

    default:
      return null;
  }
}

export function renderExtraSections(extraSections: string | null) {
  const blocks = parseExtraSections(extraSections);
  return blocks.map((block, i) => renderContentBlock(block, i));
}

export { FeatureCardsSection, ICON_MAP };
