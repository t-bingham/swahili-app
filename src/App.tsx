import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import UserPickerScreen from './screens/UserPickerScreen';
import OnboardingScreen from './screens/OnboardingScreen';
import HomeScreen from './screens/HomeScreen';
import LearnScreen from './screens/LearnScreen';
import UnitMapScreen from './screens/UnitMapScreen';
import UnitDetailScreen from './screens/UnitDetailScreen';
import UnitLessonScreen from './screens/UnitLessonScreen';
import StatsScreen from './screens/StatsScreen';
import SettingsScreen from './screens/SettingsScreen';
import PlacementTestScreen from './screens/PlacementTestScreen';
import CardGalleryScreen from './screens/CardGalleryScreen';
import ReviewScreen from './screens/ReviewScreen';
import HangulScreen from './screens/HangulScreen';
import Layout from './components/Layout';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<UserPickerScreen />} />
        <Route path="/onboarding" element={<OnboardingScreen />} />
        <Route path="/placement-test" element={<PlacementTestScreen />} />
        <Route path="/app" element={<Layout />}>
          <Route index element={<Navigate to="/app/home" replace />} />
          <Route path="home" element={<HomeScreen />} />
          <Route path="learn" element={<LearnScreen />} />
          <Route path="units" element={<UnitMapScreen track="vocabulary" />} />
          <Route path="units/:id" element={<UnitDetailScreen />} />
          <Route path="units/:id/lesson/:lessonIndex" element={<UnitLessonScreen />} />
          <Route path="grammar" element={<UnitMapScreen track="grammar" />} />
          <Route path="grammar/:id" element={<UnitDetailScreen />} />
          <Route path="grammar/:id/lesson/:lessonIndex" element={<UnitLessonScreen />} />
          <Route path="gallery" element={<CardGalleryScreen />} />
          <Route path="stats" element={<StatsScreen />} />
          <Route path="settings" element={<SettingsScreen />} />
          <Route path="review" element={<ReviewScreen />} />
          <Route path="hangul" element={<HangulScreen />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
