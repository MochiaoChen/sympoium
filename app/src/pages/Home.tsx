/**
 * Home Page — Main 7-Act Interface
 *
 * All acts live on one page, controlled by the timeline.
 * Uses Layout component and renders the current act's section.
 */

import { useSymposiumStore } from '@/store/useSymposiumStore';
import Layout from '@/components/Layout';
import {
  Act1_Inspiration,
  Act2_QuestionSelect,
  Act3_Position,
  Act4_Draft,
  Act5_Rehearsal,
  Act6_Review,
  Act7_Publish,
} from '@/sections';

const ACT_COMPONENTS = [
  null, // index 0 unused
  Act1_Inspiration,
  Act2_QuestionSelect,
  Act3_Position,
  Act4_Draft,
  Act5_Rehearsal,
  Act6_Review,
  Act7_Publish,
];

export default function Home() {
  const currentAct = useSymposiumStore((s) => s.currentAct);

  const ActComponent = ACT_COMPONENTS[currentAct] ?? Act1_Inspiration;

  return (
    <Layout>
      <ActComponent />
    </Layout>
  );
}
