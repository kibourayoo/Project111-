import { View, Text, ScrollView } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { Cairo_400Regular } from '@expo-google-fonts/cairo';
import PageHeader from '@/components/PageHeader';

const BG   = '#FDFBF7';
const TEXT = '#1A1A1A';

export default function FavoritesScreen() {
  const [fontsLoaded] = useFonts({ Cairo_400Regular });
  const fontFamily = fontsLoaded ? 'Cairo_400Regular' : undefined;

  return (
    <View style={{ flex: 1, backgroundColor: BG }}>
      <StatusBar style="dark" backgroundColor={BG} />
      <PageHeader title="المفضلة" />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }} showsVerticalScrollIndicator={false} />
    </View>
  );
}
